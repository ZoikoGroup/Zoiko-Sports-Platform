import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The SPA talks to Django on the same origin: Vite proxies /api to the backend
// (in both `vite` and `vite preview`) so session and CSRF cookies work without CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5173)
  const proxy = { '/api': { target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000' } }

  return {
    plugins: [react()],
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true, proxy },
  }
})
