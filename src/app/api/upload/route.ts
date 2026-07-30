import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { sql, getFolderIdByPath } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        const auth = await getAuthContext();
        if (!auth) throw new Error('Unauthorized');

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
            auth,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { pathname } = blob;
        const size = 0;
        
        let payloadAuth;
        try {
           const parsed = JSON.parse(tokenPayload || '{}');
           payloadAuth = parsed.auth;
        } catch(e) {
           console.error("No token payload auth");
           return;
        }

        if (!payloadAuth) return;

        const authCondition = payloadAuth.type === 'user' ? sql`user_email = ${payloadAuth.value}` : sql`secret_code = ${payloadAuth.value}`;
        const authCol = payloadAuth.type === 'user' ? sql`user_email` : sql`secret_code`;

        const parts = pathname.split('/');
        const name = parts.pop();
        const parentPath = parts.join('/');
        
        let parentId = await getFolderIdByPath(parentPath, payloadAuth);

        // Auto-create folders if they don't exist
        if (parentPath && !parentId) {
           const parentParts = parentPath.split('/');
           let currParentId = null;
           for (const part of parentParts) {
             let res: any[];
             if (currParentId === null) {
                res = await sql`SELECT id FROM nodes WHERE parent_id IS NULL AND name = ${part} AND type = 'folder' AND ${authCondition}`;
             } else {
                res = await sql`SELECT id FROM nodes WHERE parent_id = ${currParentId} AND name = ${part} AND type = 'folder' AND ${authCondition}`;
             }
             if (res.length > 0) {
               currParentId = res[0].id;
             } else {
               let expiresAt = null;
               if (payloadAuth.type === 'secret') {
                 const d = new Date(); d.setHours(d.getHours() + 24); expiresAt = d;
               }
               const insertRes: any[] = await sql`INSERT INTO nodes (parent_id, name, type, ${authCol}, expires_at) VALUES (${currParentId}, ${part}, 'folder', ${payloadAuth.value}, ${expiresAt}) RETURNING id`;
               currParentId = insertRes[0].id;
             }
           }
           parentId = currParentId;
        }

        if (name) {
           let expiresAt = null;
           if (payloadAuth.type === 'secret') {
             const d = new Date(); d.setHours(d.getHours() + 24); expiresAt = d;
           }
          await sql`
            INSERT INTO nodes (parent_id, name, type, r2_key, size, ${authCol}, expires_at)
            VALUES (${parentId}, ${name}, 'file', ${pathname}, ${size}, ${payloadAuth.value}, ${expiresAt})
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
