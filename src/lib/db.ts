import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.POSTGRES_URL!);

export interface Node {
  id: string;
  parent_id: string | null;
  name: string;
  type: 'file' | 'folder';
  r2_key: string | null;
  size: number | null;
  created_at: string;
}

/**
 * Get folder ID by path.
 */
export async function getFolderIdByPath(path: string, auth: { type: string, value: string } | null): Promise<string | null> {
  if (!path || path === '' || !auth) return null; // root is null

  const parts = path.split('/').filter(Boolean);
  
  let currentParentId = null;
  const authCondition = auth.type === 'user' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;

  for (const part of parts) {
    let res;
    if (currentParentId === null) {
      res = await sql`SELECT id FROM nodes WHERE parent_id IS NULL AND name = ${part} AND type = 'folder' AND ${authCondition} LIMIT 1`;
    } else {
      res = await sql`SELECT id FROM nodes WHERE parent_id = ${currentParentId} AND name = ${part} AND type = 'folder' AND ${authCondition} LIMIT 1`;
    }

    if (res.length === 0) {
      return null;
    }
    currentParentId = res[0].id;
  }
  return currentParentId;
}

export async function getPathByFolderId(id: string | null): Promise<string> {
  if (!id) return '';
  const parts = [];
  let currentId = id;
  
  while (currentId) {
    const res = await sql`SELECT parent_id, name FROM nodes WHERE id = ${currentId} LIMIT 1`;
    if (res.length === 0) break;
    parts.unshift(res[0].name);
    currentId = res[0].parent_id;
  }
  
  return parts.join('/');
}
