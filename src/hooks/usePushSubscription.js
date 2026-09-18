// Web Push subscription lifecycle for the lockscreen job-notifications
// feature (leave-time + wrap-up alerts). Only *dispatch* needs the VAPID
// private key (api/reminders/[action].js) — the subscribe write here is a
// plain client-side RLS insert, same pattern as client_requests/error_logs.
//
// Design: second-brain/00-inbox/2026-09-18-supermom-lockscreen-notifications-design.md §2.4.

import { useCallback, useEffect, useState } from 'react';
import { supabase, authHeaders } from '../lib/supabase';
import { getCurrentBusinessId } from '../data/currentBusiness';
import { logClientError } from '../lib/errorTracking';

const LAST_TOUCH_KEY = 'push-sub-last-seen-touch';
const TOUCH_INTERVAL_MS = 24 * 3600_000;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function upsertSubscription(sub) {
  const businessId = await getCurrentBusinessId();
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user || !businessId) return;
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      business_id: businessId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) logClientError(error, { type: 'push-subscribe-upsert' });
}

/**
 * subscribed: whether THIS device currently has an active push subscription.
 * permission: the raw Notification.permission value ('default'/'granted'/'denied').
 */
export function usePushSubscription() {
  const [permission, setPermission] = useState(() => (
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  ));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (typeof Notification === 'undefined' || !navigator.serviceWorker) {
      setSubscribed(false);
      setChecked(true);
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission !== 'granted') {
      setSubscribed(false);
      setChecked(true);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        setChecked(true);
        return;
      }
      setSubscribed(true);
      setChecked(true);
      // Rotation self-heal: if the key this subscription was made with no
      // longer matches the current VITE_VAPID_PUBLIC_KEY, re-subscribe.
      // Rotating the key pair invalidates every existing subscription (the
      // browser bound it to the old public key) — this makes a rotation
      // heal itself on the next app open instead of silently going dead.
      const currentKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const subKeyBytes = sub.options?.applicationServerKey
        ? new Uint8Array(sub.options.applicationServerKey)
        : null;
      if (currentKey && subKeyBytes) {
        const currentBytes = urlBase64ToUint8Array(currentKey);
        const same = currentBytes.length === subKeyBytes.length
          && currentBytes.every((b, i) => b === subKeyBytes[i]);
        if (!same) {
          await sub.unsubscribe();
          const fresh = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: currentBytes,
          });
          await upsertSubscription(fresh);
          localStorage.setItem(LAST_TOUCH_KEY, String(Date.now()));
          return;
        }
      }
      const lastTouch = Number(localStorage.getItem(LAST_TOUCH_KEY) || 0);
      if (Date.now() - lastTouch > TOUCH_INTERVAL_MS) {
        await upsertSubscription(sub);
        localStorage.setItem(LAST_TOUCH_KEY, String(Date.now()));
      }
    } catch (e) {
      logClientError(e, { type: 'push-check-subscription' });
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSubscription();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkSubscription]);

  // sw.js's pushsubscriptionchange handler re-subscribes itself (no Supabase
  // session inside a service worker) and hands the fresh subscription to any
  // open page via postMessage — upsert it here.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        upsertSubscription(event.data.subscription).then(() => {
          localStorage.setItem(LAST_TOUCH_KEY, String(Date.now()));
          setSubscribed(true);
        });
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener?.('message', onMessage);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('Push is not configured yet (missing VITE_VAPID_PUBLIC_KEY).');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await upsertSubscription(sub);
      localStorage.setItem(LAST_TOUCH_KEY, String(Date.now()));
      setSubscribed(true);
      return true;
    } catch (e) {
      logClientError(e, { type: 'push-enable' });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      if (navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
      return true;
    } catch (e) {
      logClientError(e, { type: 'push-disable' });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    const res = await fetch('/api/reminders/push-test', { method: 'POST', headers: await authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logClientError(new Error(data.error || `push-test ${res.status}`), { type: 'push-test' });
      throw new Error(data.error || 'Could not send test notification.');
    }
    return data;
  }, []);

  return { permission, subscribed, busy, checked, enable, disable, sendTest, refresh: checkSubscription };
}
