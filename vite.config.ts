import type { IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Serves the Vercel functions in /api during `vite dev`, so the assistant works
 * locally without the Vercel CLI. Production uses the real Vercel functions.
 */
function devApi(): Plugin {
  return {
    name: 'focusflow-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          const env = loadEnv(server.config.mode, process.cwd(), '')
          const { handleChat } = await server.ssrLoadModule('/server/chat/handler.ts')
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const response: Response = await handleChat(new Request(`http://localhost${req.originalUrl ?? req.url}`, { method: req.method, headers, body }), env)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (!response.body) return void res.end()
          const reader = response.body.getReader()
          req.on('close', () => void reader.cancel())
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        } catch (err) {
          server.config.logger.error(`[api/chat] ${(err as Error).stack ?? err}`)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/recharts|d3-|victory/.test(id)) return 'charts'
          if (/@supabase/.test(id)) return 'supabase'
          if (/react-dom|react-router|scheduler/.test(id)) return 'react'
        },
      },
    },
  },
})
