import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installGlobalErrorTracking } from './lib/errorTracking.js'
import { installAppHeight } from './lib/appHeight.js'

installGlobalErrorTracking()

// Robust viewport height across devices/nav modes — pins --app-height to the
// real visible area and re-reads at the cold-launch settle points iOS standalone
// PWA honors (it settles its final size without firing resize). See appHeight.js.
installAppHeight()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
