import '@fontsource-variable/inter'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Mount once the brand fonts are available so text never reflows from a fallback
// face after first paint (no layout shift). Capped so a slow font can't block the
// page; after the first visit the fonts come from cache and this resolves at once.
const fontsReady = Promise.all([
  document.fonts.load('700 1em Poppins'),
  document.fonts.load('600 1em Poppins'),
  document.fonts.load('400 1em "Inter Variable"'),
  document.fonts.load('700 1em "Inter Variable"'),
]).catch(() => undefined)
const timeout = new Promise((resolve) => setTimeout(resolve, 800))

Promise.race([fontsReady, timeout]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
