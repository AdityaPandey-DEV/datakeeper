import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        return {
          allowedContentTypes: [
            'image/*',
            'video/*',
            'audio/*',
            'application/pdf',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.*',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'text/*',
            'application/json',
            'application/xml',
            'application/octet-stream',
          ],
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Could log or process upload completion here
        console.log('Upload completed:', blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
