import { Router, Request, Response } from 'express'
import { PutObjectCommand, S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { s3Client, BUCKETS, getPresignEndpoint } from '../config/s3'
import { logger } from '../utils/logger'


const router = Router()
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

router.post('/init', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, contentType } = req.body
    const userId = req.headers['x-user-id'] as string

    if (!fileName || !contentType) {
      res.status(400).json({ error: 'fileName and contentType are required' })
      return
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: Missing User ID' })
      return
    }

    const videoId = crypto.randomUUID()
    const fileKey = `raw/${videoId}-${fileName.replace(/\s+/g, '_')}`

    await prisma.video.create({
      data: {
        id: videoId,
        uploader_id: userId,
        title: fileName,
        status: 'pending'
      }
    })

    const command = new PutObjectCommand({
      Bucket: BUCKETS.RAW_VIDEOS,
      Key: fileKey,
      ContentType: contentType
    })

    const presignEndpoint = getPresignEndpoint()
    const clientForPresign = presignEndpoint
      ? new S3Client({
          region: process.env.AWS_REGION!,
          endpoint: presignEndpoint,
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
          }
        })
      : s3Client

    const uploadUrl = await getSignedUrl(clientForPresign, command, { expiresIn: 3600 })

    logger.info('Presigned URL generated', { videoId, fileKey, userId })

    res.json({ videoId, fileKey, uploadUrl })

  } catch (error) {
    logger.error('Failed to generate presigned URL', { error })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId, fileKey } = req.body
    const userId = req.headers['x-user-id'] as string

    if (!videoId || !fileKey) {
      res.status(400).json({ error: 'videoId and fileKey are required' })
      return
    }

    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKETS.RAW_VIDEOS,
      Key: fileKey
    }))

    await prisma.video.update({
      where: { id: videoId, uploader_id: userId },
      data: { status: 'uploaded' }
    })

    logger.info('Video marked as uploaded', { videoId, userId })
    res.json({ success: true, videoId })

  } catch (error: any) {
    if (error.name === 'NotFound') {
      res.status(400).json({ error: 'File not found in storage' })
      return
    }
    logger.error('Failed to complete upload', { error })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router