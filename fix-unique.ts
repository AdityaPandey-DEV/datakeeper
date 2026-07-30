import fs from 'fs';

let content = fs.readFileSync('src/app/api/move/route.ts', 'utf8');
content = content.replace(
  'const folders = foldersResult.map(r => r.path);',
  'const folders = Array.from(new Set(foldersResult.map(r => r.path)));'
);
fs.writeFileSync('src/app/api/move/route.ts', content);
