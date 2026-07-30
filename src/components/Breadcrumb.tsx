'use client';

import Link from 'next/link';

interface BreadcrumbProps {
  path: string;
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const segments = path ? path.split('/').filter(Boolean) : [];
  const parentPath = segments.length > 1
    ? '/browse/' + segments.slice(0, -1).join('/')
    : '/';

  return (
    <nav className="breadcrumb" aria-label="breadcrumb">
      <Link
        href={parentPath}
        className="breadcrumb-up"
        aria-label="Go up one level"
      >
        ↑
      </Link>
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <Link href="/" className="breadcrumb-link">
            datakeeper
          </Link>
        </li>
        {segments.map((segment, index) => {
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
      </ol>
    </nav>
  );
}
