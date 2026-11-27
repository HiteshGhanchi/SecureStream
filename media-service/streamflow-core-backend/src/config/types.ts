export interface AppConfig {
  port: string | number
  nodeEnv: string
  databaseUrl: string
  dbPoolSize: number
  enableNewUploadUi: boolean
  corsOrigin: string
  s3: {
    region: string
    endpoint?: string
    presignEndpoint?: string
    buckets: {
      rawVideos: string
      hlsSegments: string
    }
  }
  keycloak: {
    url: string
    realm: string
    clientId: string
  }
  logging: {
    level: string
  }
}

export interface ClientConfig {
  apiBaseUrl: string
  keycloak: {
    url: string
    realm: string
    clientId: string
  }
}
