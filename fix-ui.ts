import fs from 'fs';

let css = fs.readFileSync('src/app/globals.css', 'utf8');

const searchCSS = `
.toolbar-search {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 6px 12px;
  gap: 8px;
  min-width: 200px;
}
.toolbar-search-input {
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  font-size: 0.8125rem;
  width: 100%;
}
.toolbar-search-input::placeholder {
  color: var(--text-tertiary);
}
.toolbar-search-icon {
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
}
`;

if (!css.includes('.toolbar-search-input')) {
  css = css.replace(
    '.toolbar-btn {',
    searchCSS + '\n.toolbar-btn {'
  );
  fs.writeFileSync('src/app/globals.css', css);
  console.log('Added toolbar-search CSS');
}

let fileList = fs.readFileSync('src/components/FileList.tsx', 'utf8');
if (!fileList.includes('<div className="file-row-date')) {
  fileList = fileList.replace(
    '<div className="file-row-size header-label sortable" onClick={() => onSort(\'size\')}>\n            Size <SortIndicator column="size" />\n          </div>\n          <div className="file-row-actions header-label sortable" onClick={() => onSort(\'date\')}>\n            Date Modified <SortIndicator column="date" />\n          </div>',
    '<div className="file-row-date header-label sortable" onClick={() => onSort(\'date\')}>\n            Date Modified <SortIndicator column="date" />\n          </div>\n          <div className="file-row-size header-label sortable" onClick={() => onSort(\'size\')}>\n            Size <SortIndicator column="size" />\n          </div>\n          <div className="file-row-actions header-label"></div>'
  );
  fs.writeFileSync('src/components/FileList.tsx', fileList);
  console.log('Fixed FileList.tsx header');
}
