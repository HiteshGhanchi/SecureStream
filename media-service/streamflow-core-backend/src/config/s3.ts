import { S3Client } from '@aws-sdk/client-s3'
import { logger } from '../utils/logger'

const isDev = !!process.env.AWS_ENDPOINT

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  ...(isDev && {
    endpoint: process.env.AWS_ENDPOINT,
    forcePathStyle: true
  }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export const getPresignEndpoint = () =>
  isDev ? process.env.AWS_PRESIGN_ENDPOINT! : undefined

export const BUCKETS = {
  RAW_VIDEOS: process.env.S3_RAW_BUCKET!,
  HLS_SEGMENTS: process.env.S3_HLS_BUCKET!
}

logger.info('S3 initialized', { isDev })