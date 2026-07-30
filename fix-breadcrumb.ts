import fs from 'fs';

let content = fs.readFileSync('src/components/Breadcrumb.tsx', 'utf8');

const replacement = `
        {segments.slice(1).map((segment, idx) => {
          const index = idx + 1; // actual index in original array
          const segmentPath = '/browse/' + segments.slice(0, index + 1).join('/');
          const isLast = index === segments.length - 1;

          return (
            <li key={segmentPath} className="breadcrumb-item">
              <span className="breadcrumb-separator">/</span>
              {isLast ? (
                <span className="breadcrumb-current">{decodeURIComponent(segment)}</span>
              ) : (
                <Link href={segmentPath} className="breadcrumb-link">
                  {decodeURIComponent(segment)}
                </Link>
              )}
            </li>
          );
        })}
`;

content = content.replace(/\{segments\.map\(\(segment, index\) => \{[\s\S]*\}\)\}/, replacement.trim());

fs.writeFileSync('src/components/Breadcrumb.tsx', content);
console.log('Fixed Breadcrumb.tsx');
