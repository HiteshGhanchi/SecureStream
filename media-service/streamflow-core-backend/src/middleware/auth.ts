import jwt from 'jsonwebtoken'
import jwksRsa from 'jwks-rsa'
import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const jwksClient = jwksRsa({
  jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 1,
})

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key?.getPublicKey())
  })
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'NO_TOKEN', message: 'No token provided' } }) 
    return
  }

  const token = authHeader.split(' ')[1]
  logger.info('Authenticating request', { path: req.path, method: req.method, token })

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded) => {
    if (err) {
      logger.warn('JWT verification failed', { error: err.message })
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } })
      return
    }

    const payload = decoded as jwt.JwtPayload
    const userId = payload.sub as string
    
    // Keycloak injects the user's email into the JWT payload by default!
    const userEmail = payload.email || `${userId}@no-email.streamflow.com`

    try {
     
      await prisma.user.upsert({
        where: { id: userId },
        update: {}, // Do nothing if they already exist
        create: {
          id: userId,
          email: userEmail,
          role: 'creator', 
        }
      });

      // Pass the verified info down to the request
      req.headers['x-user-id'] = userId
      req.headers['x-user-roles'] = payload.realm_access?.roles?.join(',') ?? ''

      // Let the user through the gate
      next() 
      
    } catch (dbError) {
      console.error('Failed to JIT sync user to database:', dbError);
      res.status(500).json({ error: { code: 'SYNC_ERROR', message: 'Identity sync failed' } });
    }
  })
}