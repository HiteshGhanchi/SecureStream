import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import { logger } from '../utils/logger'
import { AppConfig, ClientConfig } from './types'

// Helper to validate required env vars
function getEnvRequired(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getEnvOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue
}

// Resolve the path to config.json (going up from src/config)
const configPath = path.resolve(__dirname, '../../config.json')

// The loader function
function loadConfig(): AppConfig {
  let dynamicConfig: Record<string, any> = {}

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf-8')
      dynamicConfig = JSON.parse(fileContent)
    } catch (error) {
      logger.error('Failed to parse config.json', { error })
    }
  }

  // Merge static env vars with dynamic JSON vars
  return {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: getEnvRequired('DATABASE_URL'),
    dbPoolSize: dynamicConfig.db_pool_size || 10,
    enableNewUploadUi: dynamicConfig.enable_new_upload_ui || false,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    s3: {
      region: getEnvRequired('AWS_REGION'),
      endpoint: getEnvOptional('AWS_ENDPOINT'),
      presignEndpoint: getEnvOptional('AWS_PRESIGN_ENDPOINT'),
      buckets: {
        rawVideos: getEnvRequired('S3_RAW_BUCKET'),
        hlsSegments: getEnvRequired('S3_HLS_BUCKET'),
      },
    },
    keycloak: {
      url: getEnvRequired('KEYCLOAK_URL'),
      realm: getEnvRequired('KEYCLOAK_REALM'),
      clientId: getEnvRequired('KEYCLOAK_CLIENT_ID'),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  }
}

// State holding the current configuration
let currentConfig: AppConfig = loadConfig()

// Watch for changes using Chokidar
chokidar.watch(configPath).on('change', () => {
  currentConfig = loadConfig()
  logger.info('Config reloaded dynamically', {
    port: currentConfig.port,
    s3Endpoint: currentConfig.s3.endpoint,
  })
})

// 6. Export a getter function to be used throughout the app
export function getConfig(): AppConfig {
  return currentConfig;
}

// 7. Export client-safe config (only public-facing config)
export function getClientConfig(): ClientConfig {
  const config = getConfig()
  return {
    apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${config.port}`,
    keycloak: config.keycloak,
  }
}