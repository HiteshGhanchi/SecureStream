import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
const ffprobeInstaller = require('ffprobe-static');
import fs from 'fs';
import path from 'path';

// Tell fluent-ffmpeg where to find the static binaries we installed
ffmpeg.setFfmpegPath(ffmpegInstaller as string);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export function processVideoToHLS(inputPath: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    console.log(`⚙️ Starting FFmpeg transcoding... (This might take a minute)`);

    ffmpeg(inputPath)
      .outputOptions([
        '-threads 2',           // Prevent it from eating 100% of your laptop's CPU
        '-profile:v baseline',  // High compatibility
        '-level 3.0',
        '-start_number 0',      // Start segment numbering at 0
        '-hls_time 4',          // 4-second chunks
        '-hls_list_size 0',     // Keep all chunks in the playlist (VOD)
        '-f hls'                // Format is HLS
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .size('?x720')            // Smart scale to 720p height, keep aspect ratio
      .output(playlistPath)
      .on('end', () => {
        console.log(`✅ FFmpeg transcoding finished!`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`❌ FFmpeg Error:`, err.message);
        reject(err);
      })
      .run();
  });
}   