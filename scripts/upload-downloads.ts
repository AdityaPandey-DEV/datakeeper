import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';

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
    // Skip hidden files like .DS_Store and .localized
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

async function uploadAndDelete() {
  console.log(`📂 Scanning directory: ${DOWNLOADS_DIR}`);
  const files = getAllFiles(DOWNLOADS_DIR);

  if (files.length === 0) {
    console.log('✅ Downloads folder is empty or contains no valid files to upload.');
    return;
  }

  console.log(`🚀 Found ${files.length} files to upload into "${REMOTE_PREFIX}" in DataKeeper.\n`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const remotePath = `${REMOTE_PREFIX}${file.relativePath}`;
    console.log(`[${i + 1}/${files.length}] Uploading: ${file.relativePath} (${formatSize(file.size)})...`);

    try {
      const fileBuffer = fs.readFileSync(file.localPath);
      await put(remotePath, fileBuffer, {
        access: 'public',
        addRandomSuffix: false,
        token: TOKEN,
      });

      console.log(`   ✅ Success -> ${remotePath}`);
      
      // Delete the file after successful upload
      fs.unlinkSync(file.localPath);
      console.log(`   🗑️  Deleted local file: ${file.relativePath}\n`);
    } catch (err: any) {
      console.error(`   ❌ Failed to upload ${file.relativePath}: ${err.message}\n`);
      console.log(`   ⚠️  Skipping local file deletion for safety.`);
    }
  }

  console.log('🎉 Bulk upload process completed!');
}

uploadAndDelete().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
