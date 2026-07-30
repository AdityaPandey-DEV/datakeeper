'use client';

import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function Header() {
  const { data: session } = useSession();
  const [hasSecretCookie, setHasSecretCookie] = useState(false);

  useEffect(() => {
    // Check if secret_code cookie exists (we can't read httpOnly, but we can assume if they aren't in session they might be secret)
    // Actually, checking cookie from client is tricky if HttpOnly. We'll just show logout if either session exists OR we assume secret mode if they reach here without session.
  }, []);

  const handleLogout = async () => {
    if (session) {
      await signOut();
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    }
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-title">
          DataKeeper
        </Link>
        <div className="header-actions">
          <ThemeToggle />
          <button 
            onClick={handleLogout}
            style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
