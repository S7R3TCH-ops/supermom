import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installGlobalErrorTracking } from './lib/errorTracking.js'
import { installAppHeight } from './lib/appHeight.js'
import { installVpDebugOverlay } from './lib/vpDebugOverlay.js'

installGlobalErrorTracking()

// Robust viewport height across devices/nav modes — pins --app-height to the
// real visible area and re-reads at the cold-launch settle points iOS standalone
// PWA honors (it settles its final size without firing resize). See appHeight.js.
installAppHeight()

// Temporary on-device diagnostic for the iOS white-bar bug — only active with
// `?vpdebug=1`, inert otherwise. Remove once v0.13.27 is verified. See vpDebugOverlay.js.
installVpDebugOverlay()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
