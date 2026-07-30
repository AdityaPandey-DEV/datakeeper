import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

let ffmpegPath: string | null = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = null;
}

const CONCURRENCY = 4;
const CACHE_FILE = path.resolve(__dirname, '../.optimized-cache.json');

function loadCache(): Set<string> {
  try {
    if (fs.existsSync(CACHE_FILE)) return new Set(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')));
  } catch {}
  return new Set();
}

function saveCache(cache: Set<string>) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify([...cache], null, 2));
}

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
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
          if (!process.env[key.trim()]) process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const accountId = process.env.R2_ENDPOINT?.split('https://')[1]?.split('.')[0];
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME || 'datakeeper';
const publicUrl = process.env.R2_PUBLIC_URL || '';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('❌ Missing Cloudflare R2 credentials.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

function getPublicUrl(key: string) {
  const baseUrl = publicUrl.endsWith('/') ? publicUrl : publicUrl + '/';
  return baseUrl + key.split('/').map(encodeURIComponent).join('/');
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function isVideoFile(f: string): boolean {
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(path.extname(f).toLowerCase());
}

async function runPool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0;
  await Promise.all(Array(Math.min(n, items.length)).fill(0).map(async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i], i); }
  }));
}

async function main() {
  if (!ffmpegPath) { console.error('❌ ffmpeg-static not available.'); process.exit(1); }

  const cache = loadCache();
  const forceAll = process.argv.includes('--force');

  console.log('🔍 Listing all videos in Cloudflare R2...');
  let continuationToken: string | undefined;
  const allVideos: { url: string; pathname: string; size: number }[] = [];

  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: continuationToken }));
    if (r.Contents) {
      for (const b of r.Contents) {
        if (b.Key && isVideoFile(b.Key)) {
          allVideos.push({ url: getPublicUrl(b.Key), pathname: b.Key, size: b.Size || 0 });
        }
      }
    }
    continuationToken = r.NextContinuationToken;
  } while (continuationToken);

  const videos = forceAll ? allVideos : allVideos.filter(v => !cache.has(v.pathname));
  const skipped = allVideos.length - videos.length;

  console.log(`📊 Found ${allVideos.length} video(s) total, ${skipped} already optimized, ${videos.length} to fix.`);
  if (videos.length === 0) {
    console.log('✅ All videos are already optimized! Nothing to do.');
    return;
  }
  console.log(`⚡ ${CONCURRENCY} parallel workers | CRF 23 visually-lossless compression\n`);

  await runPool(videos, CONCURRENCY, async (blob, i) => {
    const tag = `[${i + 1}/${videos.length}] [${path.basename(blob.pathname)}]`;
    console.log(`${tag} Processing (${formatSize(blob.size)})...`);

    const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tmpIn = path.join('/tmp', `dl_${uid}.mp4`);
    const tmpOut = path.join('/tmp', `opt_${uid}.mp4`);

    try {
      console.log(`${tag} 📥 Downloading from R2...`);
      const res = await fetch(blob.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(tmpIn, Buffer.from(await res.arrayBuffer()));

      console.log(`${tag} 🎬 Compressing (CRF 23, veryfast, +faststart)...`);
      try {
        execFileSync(ffmpegPath, [
          '-y', '-i', tmpIn,
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
          '-crf', '23', '-preset', 'veryfast',
          '-movflags', '+faststart',
          '-c:a', 'copy',
          tmpOut
        ], { stdio: 'ignore' });
      } catch {
        execFileSync(ffmpegPath, [
          '-y', '-i', tmpIn, '-c', 'copy', '-movflags', '+faststart', tmpOut
        ], { stdio: 'ignore' });
      }

      const newSize = fs.statSync(tmpOut).size;

      if (newSize >= blob.size) {
        console.log(`${tag} ✨ Already compact. Applying FastStart for web streaming...`);
        execFileSync(ffmpegPath, [
          '-y', '-i', tmpIn, '-c', 'copy', '-movflags', '+faststart', tmpOut
        ], { stdio: 'ignore' });
      } else {
        const pct = ((1 - newSize / blob.size) * 100).toFixed(1);
        console.log(`${tag} ✨ Compressed: ${formatSize(blob.size)} → ${formatSize(newSize)} (${pct}% smaller!)`);
      }

      console.log(`${tag} 📤 Uploading back to R2...`);
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucketName,
          Key: blob.pathname,
          Body: fs.createReadStream(tmpOut),
          ContentType: 'video/mp4',
        },
      });
      await upload.done();

      cache.add(blob.pathname);
      saveCache(cache);

      console.log(`${tag} ✅ Done!\n`);
    } catch (err: any) {
      console.error(`${tag} ❌ ${err.message}\n`);
    } finally {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
  });

  console.log('🎉 All unoptimized R2 videos have been compressed & fixed!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
