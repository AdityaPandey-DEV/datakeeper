import fs from 'fs';

const filePath = 'src/app/api/files/route.ts';
let code = fs.readFileSync(filePath, 'utf8');

const searchStr = `
      let res;
      if (folderId === null) {
        res = await sql\`SELECT id, parent_id, name, type, r2_key, size, created_at FROM nodes WHERE parent_id IS NULL AND \${authCondition} AND (expires_at IS NULL OR expires_at > NOW())\`;
      } else {
`;

const replaceStr = `
      let res;
      if (folderId === null) {
        // Auto-create the user's root email folder if it doesn't exist
        if (auth.type === 'user') {
          const emailCheck = await sql\`SELECT id FROM nodes WHERE parent_id IS NULL AND name = \${auth.value} AND user_email = \${auth.value} AND type = 'folder'\`;
          if (emailCheck.length === 0) {
            await sql\`INSERT INTO nodes (parent_id, name, type, user_email) VALUES (NULL, \${auth.value}, 'folder', \${auth.value})\`;
          }
        } else if (auth.type === 'secret') {
           const secretCheck = await sql\`SELECT id FROM nodes WHERE parent_id IS NULL AND name = \${auth.value} AND secret_code = \${auth.value} AND type = 'folder'\`;
           if (secretCheck.length === 0) {
             const d = new Date(); d.setHours(d.getHours() + 24);
             await sql\`INSERT INTO nodes (parent_id, name, type, secret_code, expires_at) VALUES (NULL, \${auth.value}, 'folder', \${auth.value}, \${d})\`;
           }
        }

        res = await sql\`SELECT id, parent_id, name, type, r2_key, size, created_at FROM nodes WHERE parent_id IS NULL AND \${authCondition} AND (expires_at IS NULL OR expires_at > NOW())\`;
      } else {
`;

if (code.includes('Auto-create the user')) {
  console.log('Already fixed');
} else {
  code = code.replace(searchStr, replaceStr);
  fs.writeFileSync(filePath, code);
  console.log('Fixed src/app/api/files/route.ts');
}
