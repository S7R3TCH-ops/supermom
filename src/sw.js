import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// On install: skip waiting so the new SW activates immediately (doesn't wait
// for all tabs to close before taking over).
self.addEventListener('install', () => {
  self.skipWaiting()
})

// On activation: nuke all old caches and immediately claim clients so the
// new bundle is served right away without requiring a manual reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// SPA fallback — navigations go to index.html
registerRoute(
  new NavigationRoute(new NetworkFirst(), {
    denylist: [/^\/api\//],
  })
)

// Supabase + API calls — never cache
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/'),
  new NetworkOnly()
)

// Static assets — cache first
registerRoute(
  ({ request }) => ['style', 'script', 'image', 'font'].includes(request.destination),
  new CacheFirst()
)

// ─── Lockscreen job notifications (server-side Web Push) ───────────────────
// Replaces the old setTimeout-in-service-worker leave-time scheduling above
// (removed — a pending setTimeout does not keep a service worker alive once
// it's idle-terminated, on any platform, so it only ever fired while the app
// was foregrounded). Alerts now come from api/reminders/[action].js 'sweep'
// via web-push, which wakes a backgrounded/killed SW on both Android Chrome
// and iOS Safari (>= 16.4, installed PWA).
// Design: second-brain/00-inbox/2026-09-18-supermom-lockscreen-notifications-design.md §2.7.

// Every push event must show a notification, no exceptions — Safari revokes
// the subscription after a few "silent" pushes, and Chrome shows a generic
// "This site has been updated in the background" notice otherwise.
self.addEventListener('push', (event) => {
  let payload = null
  try {
    payload = event.data?.json() ?? null
  } catch {
    payload = null
  }

  if (!payload) {
    event.waitUntil(
      self.registration.showNotification('Supermom', {
        body: 'Open the app',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      })
    )
    return
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url, jobId: payload.jobId },
      renotify: true,
      // requireInteraction is not honoured on iOS and is mildly annoying on
      // Android for a time-sensitive nudge — deliberately omitted (was on
      // the old mechanism above).
    })
  )
})

// Tap → focus an open window and hand it the job id (Home.jsx's
// serviceWorker 'message' listener opens JobDetailSheet), or open a fresh
// window straight at the ?job= deep link if nothing's open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  const jobId = event.notification.data?.jobId || null
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) {
        const client = list[0]
        client.focus()
        if (jobId) client.postMessage({ type: 'OPEN_JOB', jobId })
        return undefined
      }
      return clients.openWindow(url)
    })
  )
})

// Browser rotated/renewed the push subscription on its own — re-subscribe
// with the same VAPID key and hand the fresh subscription to any open page
// to upsert (the SW itself has no Supabase session). If no page is open,
// usePushSubscription's foreground re-check catches the stale subscription
// on next app open instead.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
      if (!applicationServerKey) return
      const newSub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      const list = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      list.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSub }))
    })()
  )
})
