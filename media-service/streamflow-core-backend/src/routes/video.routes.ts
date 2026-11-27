import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// GET /api/videos - Fetch all videos for the logged-in user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const videos = await prisma.video.findMany({
      where: { uploader_id: userId },
      orderBy: { created_at: 'desc' }
    });

    res.json(videos);
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;