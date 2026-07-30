import fs from 'fs';

let content = fs.readFileSync('src/app/api/move/route.ts', 'utf8');

if (!content.includes('action === \'list-folders\'')) {
  const replacement = `
    const authCondition = auth.type === 'user' ? sql\`user_email = \${auth.value}\` : sql\`secret_code = \${auth.value}\`;

    if (action === 'list-folders') {
      // Fetch all folders using recursive CTE
      const foldersResult = await sql\`
        WITH RECURSIVE folder_tree AS (
            SELECT id, parent_id, name, name::text AS path
            FROM nodes
            WHERE parent_id IS NULL AND type = 'folder' AND \${authCondition}
          UNION ALL
            SELECT n.id, n.parent_id, n.name, ft.path || '/' || n.name
            FROM nodes n
            INNER JOIN folder_tree ft ON n.parent_id = ft.id
            WHERE n.type = 'folder' AND \${authCondition}
        )
        SELECT path FROM folder_tree ORDER BY path;
      \`;
      
      const folders = foldersResult.map(r => r.path);
      // The root email folder is always at index 0 because it has no parent.
      return NextResponse.json({ folders: folders });
    }

    if (!id) {
`;

  content = content.replace(
    'const authCondition = auth.type === \'user\' ? sql`user_email = ${auth.value}` : sql`secret_code = ${auth.value}`;',
    replacement
  );
  fs.writeFileSync('src/app/api/move/route.ts', content);
  console.log('Added list-folders to move route');
}
