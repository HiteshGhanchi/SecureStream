import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env variables from the .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: true
      }, // 👈 Added missing comma here
      proxy: {
        '/api': {
          // Use the env variable, but fall back to backend:3000 just in case!
          target: env.VITE_API_BASE_URL || 'http://backend:3000', 
          changeOrigin: true
        }
      }
    }
  }
})