# StreamFlow Frontend & Backend Configuration Guide

## Overview

This guide explains how configuration is handled in StreamFlow. **Everything is configurable via environment variables or API - no hardcoded values.**

## Configuration Architecture

### Frontend Configuration Flow

1. **App Startup** (`main.tsx`)
   - Calls `fetchConfig()` to get config from backend
   - Initializes Keycloak with config values
   - Wraps app with `ConfigProvider`

2. **Config Fetching** (`services/api.ts`)
   - Makes GET request to `/api/config`
   - Falls back to env vars if backend unavailable
   - Returns config to context

3. **Config Access** (`context/ConfigContext.tsx`)
   - Stores config in React Context
   - Available via `useConfig()` hook
   - Loaded once on app start

### Backend Configuration

1. **Environment Variables** (`.env`)
   - All external dependencies configured via env vars
   - Validates all required vars at startup
   - Throws error if missing critical config

2. **Dynamic Config** (`config/index.ts`)
   - `getConfig()`: Full server config (private)
   - `getClientConfig()`: Safe config for frontend (public)

3. **Public Config Endpoint** (`routes/config.routes.ts`)
   - `GET /api/config` - Returns client-safe config
   - No authentication required
   - Called by frontend on app load

## Configuration Values

### Backend Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://postgres:pass@db:5432/streamflow` |
| `AWS_REGION` | AWS/MinIO region | `ap-south-1` |
| `AWS_ENDPOINT` | MinIO URL (dev only) | `http://minio:9000` |
| `AWS_PRESIGN_ENDPOINT` | Public MinIO URL | `http://localhost:9000` |
| `AWS_ACCESS_KEY_ID` | MinIO credentials | `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | MinIO credentials | `minioadmin` |
| `S3_RAW_BUCKET` | Raw videos bucket | `streamflow-raw-videos` |
| `S3_HLS_BUCKET` | HLS segments bucket | `streamflow-hls-segments` |
| `KEYCLOAK_URL` | Keycloak server | `http://keycloak:8080` |
| `KEYCLOAK_REALM` | Keycloak realm | `streamflow` |
| `KEYCLOAK_CLIENT_ID` | Backend client ID | `streamflow-backend` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `LOG_LEVEL` | Logging level | `info` |

### Frontend Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:3001` |
| `VITE_KEYCLOAK_URL` | Keycloak server | `http://localhost:8080` |
| `VITE_KEYCLOAK_REALM` | Keycloak realm | `streamflow` |
| `VITE_KEYCLOAK_CLIENT_ID` | Frontend client ID | `streamflow-frontend` |

### Config Served by Backend (`/api/config`)

```json
{
  "data": {
    "apiBaseUrl": "http://localhost:3001",
    "keycloak": {
      "url": "http://keycloak:8080",
      "realm": "streamflow",
      "clientId": "streamflow-frontend"
    }
  },
  "meta": {
    "timestamp": "2026-05-05T10:30:00.000Z"
  }
}
```

## Usage Examples

### Backend: Accessing Configuration

```typescript
import { getConfig } from './config'

const config = getConfig()
console.log(config.s3.buckets.rawVideos)      // "streamflow-raw-videos"
console.log(config.keycloak.url)              // "http://keycloak:8080"
```

### Frontend: Accessing Configuration

```typescript
import { useConfig } from './context/ConfigContext'
import { createApiUrl } from './services/api'

function MyComponent() {
  const { config } = useConfig()
  
  const uploadUrl = createApiUrl('/api/upload/init', config.apiBaseUrl)
  
  return <div>{config.keycloak.realm}</div>
}
```

## Local Development Setup

### Start Services

```bash
# Start database, MinIO, Keycloak with docker-compose
cd /path/to/streamflow
docker-compose up -d

# Wait for services to be ready
sleep 10
```

### Backend Setup

```bash
cd core-backend

# Create .env from example
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Create .env from example
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

## Deployment

### Production Deployment

1. **Set Environment Variables**
   - Use secrets manager (AWS Secrets, Kubernetes Secrets, etc.)
   - Never commit `.env` files with real values

2. **Backend Configuration**
   ```bash
   export API_BASE_URL=https://api.streamflow.com
   export KEYCLOAK_URL=https://auth.streamflow.com
   export DATABASE_URL=postgresql://user:pass@prod-db:5432/streamflow
   export AWS_REGION=us-east-1
   # ... other prod vars
   ```

3. **Frontend Configuration**
   - Built with Vite, env vars baked in at build time
   - Use different builds for different environments
   - Or set vars in CI/CD pipeline before build

## Adding New Configuration

### To Backend

1. Add to `.env.example`
2. Read in `config/index.ts`
3. Add to `AppConfig` or `ClientConfig` types
4. Use via `getConfig()`

### To Frontend

1. Add to `.env.example`
2. Add to backend's `ClientConfig`
3. Access via `useConfig()` hook

## Troubleshooting

### "Missing required environment variable: X"

- Backend started without required env var
- Check `.env` file exists and has all required values
- Reference `.env.example` for complete list

### Frontend shows "Unable to load application"

- Backend `/api/config` endpoint is not responding
- Check backend is running: `curl http://localhost:3001/health`
- Check CORS settings in backend `.env`
- Check browser console for specific error

### "Failed to upload - presigned URL invalid"

- MinIO endpoint not accessible from frontend
- Check `AWS_PRESIGN_ENDPOINT` is publicly accessible
- For local dev: ensure `http://localhost:9000` is used

## Security Best Practices

✅ **Never commit `.env` files** - use `.env.example` as template
✅ **Use environment variables** for all sensitive data
✅ **Separate concerns** - frontend gets only what it needs
✅ **Validate inputs** - all route inputs validated with Zod
✅ **Use presigned URLs** - don't expose S3 credentials to frontend
✅ **CORS properly** - whitelist only trusted origins

## Related Files

- Backend config: `core-backend/src/config/`
- Frontend config: `frontend/src/context/ConfigContext.tsx`
- API services: `frontend/src/services/api.ts`
- Backend routes: `core-backend/src/routes/config.routes.ts`
