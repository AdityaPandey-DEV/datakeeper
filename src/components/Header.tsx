'use client';

import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-title">
          DataKeeper
        </Link>
        <div className="header-actions">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
