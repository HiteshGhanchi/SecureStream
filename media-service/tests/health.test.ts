import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('ops endpoints', () => {
  const app = createApp()

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ service: 'media-service', status: 'ok' })
  })

  it('GET /ready returns ok', async () => {
    const res = await request(app).get('/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('does not advertise Express', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
