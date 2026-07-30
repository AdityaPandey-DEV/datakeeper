import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { list, put, del } from '@vercel/blob';

// Optional static ffmpeg binary if available
let ffmpegPath: string | null = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = null;
}

const CONCURRENCY = 4; // 4x parallel workers with Apple Silicon GPU hardware acceleration

// Load BLOB_READ_WRITE_TOKEN from .env.local
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let val = valueParts.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key.trim()]) process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error('❌ Error: BLOB_READ_WRITE_TOKEN is not set.');
  process.exit(1);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(ext);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  let currentIndex = 0;
  const workers = Array(Math.min(concurrency, items.length))
    .fill(0)
    .map(async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        await worker(items[index], index);
      }
    });
  await Promise.all(workers);
}

async function optimizeRemoteVideos() {
  if (!ffmpegPath) {
    console.error('❌ Error: ffmpeg-static is not available.');
    process.exit(1);
  }

  console.log('🔍 Listing all videos in your DataKeeper cloud...');
  let cursor: string | undefined;
  let hasMore = true;
  const videoBlobs: { url: string; pathname: string; size: number }[] = [];

  while (hasMore) {
    const response = await list({ cursor, limit: 1000, token: TOKEN });
    for (const blob of response.blobs) {
      if (isVideoFile(blob.pathname)) {
        videoBlobs.push({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
        });
      }
    }
    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  console.log(`🚀 Found ${videoBlobs.length} video(s) in cloud.`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel workers | Apple GPU (Metal/VideoToolbox) Accelerated!\n`);

  await runWithConcurrency(videoBlobs, CONCURRENCY, async (blob, i) => {
    const tag = `[${i + 1}/${videoBlobs.length}] [${path.basename(blob.pathname)}]`;
    console.log(`${tag} Processing (${formatSize(blob.size)})...`);

    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempInput = path.join('/tmp', `dl_${uniqueId}_input.mp4`);
    const tempOutput = path.join('/tmp', `opt_${uniqueId}_output.mp4`);

    try {
      // 1. Download video from Vercel Blob to /tmp
      console.log(`${tag} 📥 Downloading from CDN...`);
      const res = await fetch(blob.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(tempInput, Buffer.from(arrayBuffer));

      // 2. Optimize with Apple GPU Hardware Acceleration (h264_videotoolbox) with fallback to libx264
      try {
        console.log(`${tag} ⚡ Apple GPU (VideoToolbox) Hardware Encoding...`);
        execFileSync(ffmpegPath, [
          '-y',
          '-i', tempInput,
          '-c:v', 'h264_videotoolbox',
          '-q:v', '65',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-c:a', 'copy',
          tempOutput
        ], { stdio: 'ignore' });
      } catch (gpuErr) {
        console.log(`${tag} ⚠️  GPU encoder fallback -> CPU libx264...`);
        execFileSync(ffmpegPath, [
          '-y',
          '-i', tempInput,
          '-vcodec', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-crf', '25',
          '-preset', 'fast',
          '-movflags', '+faststart',
          '-acodec', 'copy',
          tempOutput
        ], { stdio: 'ignore' });
      }

      const newSize = fs.statSync(tempOutput).size;
      const savedPct = ((1 - newSize / blob.size) * 100).toFixed(1);
      console.log(`${tag} ✨ Optimized: ${formatSize(blob.size)} -> ${formatSize(newSize)} (${savedPct}% saved!)`);

      // 3. Re-upload and overwrite remote blob
      console.log(`${tag} 📤 Uploading web-playable version...`);
      const fileBuffer = fs.readFileSync(tempOutput);
      await put(blob.pathname, fileBuffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'video/mp4',
        token: TOKEN,
      });

      console.log(`${tag} ✅ Successfully repaired and optimized!\n`);
    } catch (err: any) {
      console.error(`${tag} ❌ Failed to process: ${err.message}\n`);
    } finally {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
  });

  console.log('🎉 All remote videos have been optimized and repaired for web playback!');
}

optimizeRemoteVideos().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
