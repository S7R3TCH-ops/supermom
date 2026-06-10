import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

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

// ─── Leave-time notification scheduling ────────────────────────────────────
const pendingTimeouts = new Map()

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SCHEDULE_LEAVE_NOTIFICATIONS') return

  // Cancel previous schedule
  for (const tid of pendingTimeouts.values()) clearTimeout(tid)
  pendingTimeouts.clear()

  const now = Date.now()
  for (const job of (event.data.jobs ?? [])) {
    const delay = job.fireAt - now
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue

    const tid = setTimeout(() => {
      self.registration.showNotification(`Leave now for ${job.clientName}`, {
        body: job.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `leave-${job.id}`,
        requireInteraction: true,
        data: { jobId: job.id },
      })
      pendingTimeouts.delete(job.id)
    }, delay)

    pendingTimeouts.set(job.id, tid)
  }

  event.source?.postMessage({ type: 'NOTIFICATIONS_SCHEDULED', count: pendingTimeouts.size })
})

// Tapping the notification focuses the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list[0].focus()
      return clients.openWindow('/')
    })
  )
})
