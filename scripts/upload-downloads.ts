import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { put } from '@vercel/blob';

// Optional static ffmpeg binary if available
let ffmpegPath: string | null = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = null;
}

// Load BLOB_READ_WRITE_TOKEN from .env.local if not already in process.env
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let val = valueParts.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  }
}

loadEnvLocal();

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error('❌ Error: BLOB_READ_WRITE_TOKEN is not set in .env.local or environment.');
  process.exit(1);
}

const DOWNLOADS_DIR = path.resolve(process.env.HOME || '/Users/adityapandeydev', 'Downloads');
const REMOTE_PREFIX = 'Course-Uploads/'; // The root folder in DataKeeper where files will go
const USE_OPTIMIZE = process.argv.includes('--optimize') || process.argv.includes('-o');
const CONCURRENCY = 4; // 4x Parallel Workers for hardware GPU speed

interface FileEntry {
  localPath: string;
  relativePath: string;
  size: number;
}

function getAllFiles(dirPath: string, baseDir: string = dirPath): FileEntry[] {
  const entries: FileEntry[] = [];
  if (!fs.existsSync(dirPath)) return entries;

  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      entries.push(...getAllFiles(fullPath, baseDir));
    } else if (item.isFile()) {
      const stat = fs.statSync(fullPath);
      const relativePath = path.relative(baseDir, fullPath);
      entries.push({
        localPath: fullPath,
        relativePath,
        size: stat.size,
      });
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

function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(ext);
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Optimize video using Apple Silicon Metal/GPU Hardware Acceleration (h264_videotoolbox) with fallback to libx264
 */
function optimizeVideo(inputPath: string, relativePath: string, tag: string): { uploadPath: string; isTemporary: boolean } {
  if (!ffmpegPath) {
    console.log(`${tag} ⚠️  FFmpeg not found. Uploading original video without optimization.`);
    return { uploadPath: inputPath, isTemporary: false };
  }

  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempOutputPath = path.join('/tmp', `opt_${uniqueId}_${path.basename(inputPath, path.extname(inputPath))}.mp4`);

  try {
    // 1. Try Apple Silicon Metal/GPU Media Engine Hardware Acceleration (h264_videotoolbox) ~30x-50x speed
    console.log(`${tag} ⚡ Apple GPU (VideoToolbox) Hardware Encoding...`);
    execFileSync(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-c:v', 'h264_videotoolbox',
      '-q:v', '65',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'copy',
      tempOutputPath
    ], { stdio: 'ignore' });
  } catch (gpuErr) {
    // 2. Fallback to CPU software encoding (libx264)
    console.log(`${tag} ⚠️  GPU encoder fallback -> CPU libx264...`);
    execFileSync(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '25',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-acodec', 'copy',
      tempOutputPath
    ], { stdio: 'ignore' });
  }

  const origSize = fs.statSync(inputPath).size;
  const newSize = fs.statSync(tempOutputPath).size;
  const savedPct = ((1 - newSize / origSize) * 100).toFixed(1);

  console.log(`${tag} ✨ Optimized: ${formatSize(origSize)} -> ${formatSize(newSize)} (${savedPct}% saved!)`);
  return { uploadPath: tempOutputPath, isTemporary: true };
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

async function uploadAndDelete() {
  console.log(`📂 Scanning directory: ${DOWNLOADS_DIR}`);
  const files = getAllFiles(DOWNLOADS_DIR);

  if (files.length === 0) {
    console.log('✅ Downloads folder is empty or contains no valid files to upload.');
    return;
  }

  console.log(`🚀 Found ${files.length} files to upload into "${REMOTE_PREFIX}" in DataKeeper.`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel workers | Apple GPU (Metal/VideoToolbox) Accelerated!`);
  if (USE_OPTIMIZE) {
    console.log(`🎬 FFmpeg Video Optimization ENABLED (--optimize)`);
  }
  console.log('');

  await runWithConcurrency(files, CONCURRENCY, async (file, index) => {
    const tag = `[${index + 1}/${files.length}] [${path.basename(file.relativePath)}]`;
    let remotePath = `${REMOTE_PREFIX}${file.relativePath}`;
    console.log(`${tag} 🚀 Processing (${formatSize(file.size)})...`);

    let sourcePath = file.localPath;
    let isTemporary = false;

    if (USE_OPTIMIZE && isVideoFile(file.localPath)) {
      const opt = optimizeVideo(file.localPath, file.relativePath, tag);
      sourcePath = opt.uploadPath;
      isTemporary = opt.isTemporary;
      if (isTemporary && !remotePath.endsWith('.mp4')) {
        remotePath = remotePath.slice(0, remotePath.lastIndexOf('.')) + '.mp4';
      }
    }

    try {
      console.log(`${tag} 📤 Uploading to CDN...`);
      const fileBuffer = fs.readFileSync(sourcePath);
      const contentType = getContentType(remotePath);
      await put(remotePath, fileBuffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
        token: TOKEN,
      });

      console.log(`${tag} ✅ Success (${contentType}) -> ${remotePath}`);
      
      if (isTemporary && fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
      }

      fs.unlinkSync(file.localPath);
      console.log(`${tag} 🗑️  Deleted local file\n`);
    } catch (err: any) {
      console.error(`${tag} ❌ Failed to upload: ${err.message}\n`);
      if (isTemporary && fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
      }
    }
  });

  console.log('🎉 Bulk upload process completed!');
}

uploadAndDelete().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
