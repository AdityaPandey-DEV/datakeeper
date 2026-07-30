import fs from 'fs';

let content = fs.readFileSync('src/components/UploadArea.tsx', 'utf8');
content = content.replace(
  'interface UploadAreaProps {',
  'interface UploadAreaProps {\n  inputRef?: React.RefObject<HTMLInputElement>;'
);
content = content.replace(
  'export function UploadArea({ currentPath, onUploadComplete }: UploadAreaProps) {',
  'export function UploadArea({ currentPath, onUploadComplete, inputRef }: UploadAreaProps) {'
);
content = content.replace(
  'const fileInputRef = useRef<HTMLInputElement>(null);',
  'const internalRef = useRef<HTMLInputElement>(null);\n  const fileInputRef = inputRef || internalRef;'
);

fs.writeFileSync('src/components/UploadArea.tsx', content);

let browserContent = fs.readFileSync('src/components/FileBrowser.tsx', 'utf8');
browserContent = browserContent.replace(
  '<UploadArea\n        currentPath={initialPath}\n        onUploadComplete={fetchFiles}\n      />',
  '<UploadArea\n        currentPath={initialPath}\n        onUploadComplete={fetchFiles}\n        inputRef={uploadInputRef}\n      />'
);
fs.writeFileSync('src/components/FileBrowser.tsx', browserContent);
console.log('Fixed upload ref!');
