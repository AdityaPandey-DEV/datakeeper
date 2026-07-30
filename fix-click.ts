import fs from 'fs';

let content = fs.readFileSync('src/components/FileRow.tsx', 'utf8');

content = content.replace(
  'onDoubleClick={(e) => {',
  'onClick={(e) => {'
);
content = content.replace(
  'setIsRenaming(true);',
  'onPreview();'
);
content = content.replace(
  'className="file-name-text"',
  'className="file-name-text"\n            style={{ cursor: item.type === "file" ? "pointer" : "inherit" }}'
);

fs.writeFileSync('src/components/FileRow.tsx', content);
console.log('Fixed FileRow.tsx click behavior!');
