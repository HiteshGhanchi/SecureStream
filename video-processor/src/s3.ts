import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password',
  }
});

// Download the raw video from MinIO to the worker's local disk
export async function downloadVideo(fileKey: string, downloadPath: string) {
  console.log(`Downloading ${fileKey} from MinIO...`);
  const command = new GetObjectCommand({
    Bucket: process.env.S3_RAW_BUCKET || 'raw-videos',
    Key: fileKey,
  });

  const response = await s3.send(command);
  if (!response.Body) throw new Error('Failed to fetch video body from S3');

  const fileStream = fs.createWriteStream(downloadPath);
  // @ts-ignore - The AWS SDK stream typing can be finicky
  await pipeline(response.Body, fileStream);
  console.log(`Download complete: ${downloadPath}`);
}

// Upload the generated .m3u8 and .ts chunks back to MinIO
export async function uploadHlsFolder(folderPath: string, videoId: string) {
  console.log(`Uploading HLS chunks for ${videoId} to MinIO...`);
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const fileStream = fs.createReadStream(filePath);
    
    // Set proper content types for video streaming
    const contentType = file.endsWith('.m3u8') 
      ? 'application/vnd.apple.mpegurl' 
      : 'video/MP2T';

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_HLS_BUCKET || 'hls-streams',
      Key: `${videoId}/${file}`,
      Body: fileStream,
      ContentType: contentType,
    }));
  }
  console.log(`Uploaded ${files.length} HLS files for ${videoId}!`);
}