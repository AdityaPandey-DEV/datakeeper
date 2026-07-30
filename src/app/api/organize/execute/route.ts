import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function getS3Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Missing Cloudflare R2 environment variables.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME || 'datakeeper';
}

export async function POST(request: NextRequest) {
  try {
    const { moves } = await request.json();

    if (!Array.isArray(moves) || moves.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty moves array' },
        { status: 400 }
      );
    }

    const s3 = getS3Client();
    const bucket = getBucketName();

    const results: any[] = [];

    // Helper to chunk the array for concurrency
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
      return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );
    };

    const chunks = chunkArray(moves, 10); // Process 10 files concurrently

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (move: any) => {
        if (!move.old_path || !move.new_path) return;

        try {
          // 1. Copy
          await s3.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${encodeURI(move.old_path)}`,
            Key: move.new_path,
          }));

          // 2. Delete
          await s3.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: move.old_path,
          }));

          results.push({ ...move, success: true });
        } catch (err: any) {
          console.error(`Failed to move ${move.old_path} to ${move.new_path}:`, err);
          results.push({ ...move, success: false, error: err.message });
        }
      }));
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error executing organization plan:', error);
    return NextResponse.json(
      { error: 'Failed to execute organization plan' },
      { status: 500 }
    );
  }
}
