'use client';

import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function Header() {
  const sessionContext = useSession();
  const session = sessionContext?.data;
  const [hasSecretCookie, setHasSecretCookie] = useState(false);

  useEffect(() => {
    // If we have no session, we might be using a secret code.
    if (!session) {
      setHasSecretCookie(document.cookie.includes('secret_code')); // Note: HttpOnly means we can't actually read this here reliably if we rely on HttpOnly.
      // We'll just assume they have access if they can see the header and aren't logged in.
    }
  }, [session]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-title">
          DataKeeper
        </Link>
        <div className="header-actions">
          <ThemeToggle />
          
          <Link href="/profile" style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem', textDecoration: 'none' }}>
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Profile" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
              />
            ) : (
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: 'var(--text-primary)',
                color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '1rem', border: '2px solid var(--border-color)'
              }}>
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'S'}
              </div>
            )}
          </Link>

        </div>
      </div>
    </header>
  );
}
