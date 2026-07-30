import fs from 'fs';
import path from 'path';
import { list, copy, del } from '@vercel/blob';

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

async function fixContentTypes() {
  console.log('🔍 Scanning Vercel Blob store for files with incorrect content-types...');
  let cursor: string | undefined;
  let hasMore = true;
  let fixedCount = 0;

  while (hasMore) {
    const response = await list({ cursor, limit: 1000, token: TOKEN });

    for (const blob of response.blobs) {
      if (blob.pathname.endsWith('.keep')) continue;

      const expectedType = getContentType(blob.pathname);
      // Copying the blob to the exact same pathname with explicit contentType updates its MIME header in Vercel Blob
      console.log(`🔧 Updating MIME type for: ${blob.pathname} -> [${expectedType}]`);
      try {
        await copy(blob.url, blob.pathname, {
          access: 'public',
          addRandomSuffix: false,
          contentType: expectedType,
          token: TOKEN,
        });
        fixedCount++;
      } catch (err: any) {
        console.error(`   ❌ Failed to update ${blob.pathname}: ${err.message}`);
      }
    }

    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  console.log(`\n🎉 Completed! Fixed MIME content-types for ${fixedCount} uploaded file(s).`);
}

fixContentTypes().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
