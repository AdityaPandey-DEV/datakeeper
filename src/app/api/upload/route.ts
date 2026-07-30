import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { sql, getFolderIdByPath } from '@/lib/db';

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
        const { pathname } = blob;
        const size = 0;
        console.log('Upload completed:', pathname);

        const parts = pathname.split('/');
        const name = parts.pop();
        const parentPath = parts.join('/');
        
        let parentId = await getFolderIdByPath(parentPath);

        // Auto-create folders if they don't exist
        if (parentPath && !parentId) {
           // Basic recursive creation
           const parentParts = parentPath.split('/');
           let currParentId = null;
           for (const part of parentParts) {
             const res: any[] = await sql`SELECT id FROM nodes WHERE parent_id ${currParentId === null ? sql`IS NULL` : sql`= ${currParentId}`} AND name = ${part} AND type = 'folder'`;
             if (res.length > 0) {
               currParentId = res[0].id;
             } else {
               const insertRes: any[] = await sql`INSERT INTO nodes (parent_id, name, type) VALUES (${currParentId}, ${part}, 'folder') RETURNING id`;
               currParentId = insertRes[0].id;
             }
           }
           parentId = currParentId;
        }

        if (name) {
          await sql`
            INSERT INTO nodes (parent_id, name, type, r2_key, size)
            VALUES (${parentId}, ${name}, 'file', ${pathname}, ${size})
          `;
        }
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
