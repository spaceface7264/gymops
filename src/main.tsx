import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from '@/App'
import '@/index.css'
import '@/lib/i18n'

// P5-05: the service worker precaches the build and receives web push. It
// updates itself, so a phone left on the home screen for a week is not running
// last week's app.
registerSW({ immediate: true })

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
