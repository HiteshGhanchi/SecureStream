import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'

export function createApp(): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(pinoHttp())

  // Liveness: the process is up.
  app.get('/health', (_req, res) => {
    res.status(200).json({ service: 'media-service', status: 'ok' })
  })

  // Readiness: no external dependencies yet. The database check is added
  // together with the Prisma schema in F4.
  app.get('/ready', (_req, res) => {
    res.status(200).json({ service: 'media-service', status: 'ok' })
  })

  return app
}
