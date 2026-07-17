import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installGlobalErrorTracking } from './lib/errorTracking.js'

installGlobalErrorTracking()

// Robust viewport height across devices/nav modes. dvh misreports on some
// browsers (older iOS standalone, Android chrome transitions); this pins
// --app-height to the actual visible area (visualViewport when available) and
// keeps it correct through rotation, keyboard, and nav-bar show/hide.
function setAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)
window.visualViewport?.addEventListener('resize', setAppHeight)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
