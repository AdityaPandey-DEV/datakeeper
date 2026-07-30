import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAuthContext } from '@/lib/auth';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Prefix with user email to enforce strict isolation in R2, avoid duplicating if already present
    const key = filename.startsWith(auth.value + '/') || filename === auth.value
      ? filename
      : `${auth.value}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'datakeeper',
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    });

    // Generate a presigned URL valid for 5 minutes (300 seconds)
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return NextResponse.json({ 
      url: presignedUrl, 
      key 
    });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
