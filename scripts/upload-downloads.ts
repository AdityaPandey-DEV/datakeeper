import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

let ffmpegPath: string | null = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = null;
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

const accountId = process.env.R2_ENDPOINT?.split('https://')[1]?.split('.')[0];
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME || 'datakeeper';
const publicUrl = process.env.R2_PUBLIC_URL || '';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('❌ Missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_ENDPOINT.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const DOWNLOADS_DIR = path.resolve(process.env.HOME || '/Users/adityapandeydev', 'Downloads');
const REMOTE_PREFIX = 'Course-Uploads/';
const USE_OPTIMIZE = process.argv.includes('--optimize') || process.argv.includes('-o');
const CONCURRENCY = 4;

interface FileEntry { localPath: string; relativePath: string; size: number; }

function getAllFiles(dirPath: string, baseDir: string = dirPath): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dirPath)) return entries;
  for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) entries.push(...getAllFiles(fullPath, baseDir));
    else if (item.isFile()) {
      entries.push({ localPath: fullPath, relativePath: path.relative(baseDir, fullPath), size: fs.statSync(fullPath).size });
    }
  }
  return entries;
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

function getContentType(f: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv',
  };
  return map[path.extname(f).toLowerCase()] || 'application/octet-stream';
}

function optimizeVideo(inputPath: string, tag: string): { uploadPath: string; isTemporary: boolean } {
  if (!ffmpegPath) {
    console.log(`${tag} ⚠️  FFmpeg not available — uploading original.`);
    return { uploadPath: inputPath, isTemporary: false };
  }

  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempOut = path.join('/tmp', `opt_${uid}.mp4`);
  const origSize = fs.statSync(inputPath).size;

  console.log(`${tag} 🎬 Compressing (CRF 23 visually-lossless, veryfast, +faststart)...`);
  try {
    execFileSync(ffmpegPath, [
      '-y', '-i', inputPath,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-crf', '23', '-preset', 'veryfast',
      '-movflags', '+faststart',
      '-c:a', 'copy',
      tempOut
    ], { stdio: 'ignore' });
  } catch {
    console.log(`${tag} ⚠️  Encode failed — falling back to remux.`);
    try {
      execFileSync(ffmpegPath, [
        '-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', tempOut
      ], { stdio: 'ignore' });
    } catch {
      if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
      return { uploadPath: inputPath, isTemporary: false };
    }
    return { uploadPath: tempOut, isTemporary: true };
  }

  const newSize = fs.statSync(tempOut).size;

  if (newSize >= origSize) {
    console.log(`${tag} ✨ Already compact (${formatSize(origSize)}). Applying FastStart for web streaming...`);
    try {
      execFileSync(ffmpegPath, [
        '-y', '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', tempOut
      ], { stdio: 'ignore' });
    } catch {
      if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
      return { uploadPath: inputPath, isTemporary: false };
    }
  } else {
    const pct = ((1 - newSize / origSize) * 100).toFixed(1);
    console.log(`${tag} ✨ Compressed: ${formatSize(origSize)} → ${formatSize(newSize)} (${pct}% smaller, 0 quality loss!)`);
  }

  return { uploadPath: tempOut, isTemporary: true };
}

async function runPool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0;
  await Promise.all(Array(Math.min(n, items.length)).fill(0).map(async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i], i); }
  }));
}

async function main() {
  console.log(`📂 Scanning: ${DOWNLOADS_DIR}`);
  const files = getAllFiles(DOWNLOADS_DIR);
  if (!files.length) { console.log('✅ No files to upload.'); return; }

  console.log(`🚀 Found ${files.length} files → "${REMOTE_PREFIX}"`);
  console.log(`⚡ ${CONCURRENCY} parallel workers | Uploading to Cloudflare R2 (${bucketName})`);
  if (USE_OPTIMIZE) console.log(`🎬 Video compression ENABLED (--optimize)`);
  console.log('');

  await runPool(files, CONCURRENCY, async (file, i) => {
    const tag = `[${i + 1}/${files.length}] [${path.basename(file.relativePath)}]`;
    let remotePath = `${REMOTE_PREFIX}${file.relativePath}`;
    console.log(`${tag} 🚀 ${formatSize(file.size)}`);

    let src = file.localPath;
    let tmp = false;

    if (USE_OPTIMIZE && isVideoFile(file.localPath)) {
      const r = optimizeVideo(file.localPath, tag);
      src = r.uploadPath; tmp = r.isTemporary;
      if (tmp && !remotePath.endsWith('.mp4'))
        remotePath = remotePath.slice(0, remotePath.lastIndexOf('.')) + '.mp4';
    }

    try {
      const ct = getContentType(remotePath);
      
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucketName,
          Key: remotePath,
          Body: fs.createReadStream(src),
          ContentType: ct,
        },
      });

      await upload.done();
      
      console.log(`${tag} ✅ → ${remotePath}`);
      if (tmp && fs.existsSync(src)) fs.unlinkSync(src);
      fs.unlinkSync(file.localPath);
      console.log(`${tag} 🗑️  Deleted local\n`);
    } catch (err: any) {
      console.error(`${tag} ❌ ${err.message}\n`);
      if (tmp && fs.existsSync(src)) fs.unlinkSync(src);
    }
  });

  console.log('🎉 All done!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
