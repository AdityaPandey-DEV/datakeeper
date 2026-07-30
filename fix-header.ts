import fs from 'fs';
let content = fs.readFileSync('src/app/layout.tsx', 'utf8');
content = content.replace(
  '<Header />\n          <main className="main-content">\n            <Providers>\n              {children}\n            </Providers>\n          </main>',
  '<Providers>\n            <Header />\n            <main className="main-content">\n              {children}\n            </main>\n          </Providers>'
);
fs.writeFileSync('src/app/layout.tsx', content);
console.log('Fixed layout.tsx');
