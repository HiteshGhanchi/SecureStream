import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env['PORT'] ?? 8002)
const server = createApp().listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', msg: 'media-service listening', port }))
})

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: 'info', msg: 'shutting down', signal }))
  server.close(() => process.exit(0))
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
