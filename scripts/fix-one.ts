import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { list, put } from '@vercel/blob';

const ffmpegPath = require('ffmpeg-static');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const [k, ...v] = t.split('=');
      let val = v.join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[k.trim()]) process.env[k.trim()] = val;
    }
  }
}

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
const TARGET = 'Matrix Chain Multiplication';

async function main() {
  console.log(`🔍 Finding "${TARGET}" in cloud...`);
  let cursor: string | undefined;
  let hasMore = true;
  let blob: { url: string; pathname: string; size: number } | null = null;

  while (hasMore) {
    const r = await list({ cursor, limit: 1000, token: TOKEN });
    for (const b of r.blobs) {
      if (b.pathname.includes(TARGET)) { blob = { url: b.url, pathname: b.pathname, size: b.size }; break; }
    }
    if (blob) break;
    hasMore = r.hasMore;
    cursor = r.cursor;
  }

  if (!blob) { console.error('❌ Not found!'); return; }

  const fmt = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  console.log(`📥 Downloading ${blob.pathname} (${fmt(blob.size)})...`);
  const res = await fetch(blob.url);
  const tmpIn = '/tmp/fix_mcm_input.mp4';
  const tmpOut = '/tmp/fix_mcm_output.mp4';
  fs.writeFileSync(tmpIn, Buffer.from(await res.arrayBuffer()));

  console.log('🎬 Compressing (CRF 23, veryfast, yuv420p, +faststart)...');
  execFileSync(ffmpegPath, [
    '-y', '-i', tmpIn,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-crf', '23', '-preset', 'veryfast',
    '-movflags', '+faststart',
    '-c:a', 'copy', tmpOut
  ], { stdio: 'inherit' });

  const newSize = fs.statSync(tmpOut).size;
  const pct = ((1 - newSize / blob.size) * 100).toFixed(1);
  console.log(`✨ ${fmt(blob.size)} → ${fmt(newSize)} (${pct}% smaller!)`);

  console.log('📤 Uploading fixed version...');
  await put(blob.pathname, fs.readFileSync(tmpOut), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'video/mp4', token: TOKEN,
  });

  fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut);
  console.log(`✅ ${blob.pathname} fixed and playable!`);
}

main();
