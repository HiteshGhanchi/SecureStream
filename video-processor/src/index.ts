import 'dotenv/config';
import { Kafka } from 'kafkajs';
import { Client } from 'pg'; // <-- Replaced Prisma with pg
import fs from 'fs';
import path from 'path';
import { downloadVideo, uploadHlsFolder } from './s3';
import { processVideoToHLS } from './transcoder';


// Initialize the lightweight Postgres Client
const db = new Client({
  connectionString: process.env.DATABASE_URL_None
});

const kafka = new Kafka({
  clientId: 'video-processor-worker',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'transcoding-group' });
const TEMP_DIR = path.join(__dirname, '../temp');

async function main() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

  // Connect to DB and Kafka
  await db.connect();
  await consumer.connect();
  console.log('✅ Connected to Kafka and Postgres!');

  await consumer.subscribe({ topic: 'db.public.Video', fromBeginning: false });
  console.log('🎧 Listening for new video uploads...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      try {
        const event = JSON.parse(message.value.toString());
        if (!event.payload || !event.payload.after) return;

        const videoData = event.payload.after;

        if (videoData.status === 'uploaded') {
          console.log('\n======================================');
          console.log(`🚀 NEW UPLOAD DETECTED: ${videoData.title}`);
          
          const fileKey = `raw/${videoData.id}-${videoData.title.replace(/\s+/g, '_')}`;
          const rawFilePath = path.join(TEMP_DIR, `${videoData.id}.mp4`);
          const hlsOutputDir = path.join(TEMP_DIR, `hls-${videoData.id}`);

          // 1. Download
          await downloadVideo(fileKey, rawFilePath);

          // 2. Transcode
          await processVideoToHLS(rawFilePath, hlsOutputDir);

          // 3. Upload chunks
          await uploadHlsFolder(hlsOutputDir, videoData.id);

          // 4. Update Database using raw SQL
          const hlsUrl = `http://localhost:9000/${process.env.S3_HLS_BUCKET || 'hls-streams'}/${videoData.id}/playlist.m3u8`;
          
          await db.query(
            `UPDATE "Video" SET status = 'ready', hls_url = $1 WHERE id = $2`,
            [hlsUrl, videoData.id]
          );

          console.log(`🎉 VIDEO ${videoData.id} IS FULLY PROCESSED AND READY!`);
          console.log('======================================\n');

          // Cleanup local temp files
          fs.rmSync(rawFilePath, { force: true });
          fs.rmSync(hlsOutputDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error('❌ Processing Error:', error);
      }
    },
  });
}

main().catch(console.error);

process.on('SIGINT', async () => {
  await consumer.disconnect();
  await db.end(); // Close DB connection cleanly
  process.exit(0);
});