import { Router, Request, Response } from 'express'
import { getClientConfig } from '../config'
import { logger } from '../utils/logger'

const router = Router()

/**
 * GET /api/config
 * Returns public configuration for the frontend
 * No authentication required
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const clientConfig = getClientConfig()
    logger.info('Config endpoint accessed')
    res.json({ data: clientConfig, meta: { timestamp: new Date().toISOString() } })
  } catch (error) {
    logger.error('Failed to get config', { error })
    res.status(500).json({
      error: { code: 'CONFIG_ERROR', message: 'Failed to retrieve configuration' },
      meta: { timestamp: new Date().toISOString() },
    })
  }
})

export default router
