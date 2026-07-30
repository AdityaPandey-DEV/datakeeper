'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function LandingPage() {
  const [secretCode, setSecretCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretCode.trim()) return;

    setIsLoading(true);
    try {
      await fetch('/api/auth/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode: secretCode.trim() }),
      });
      // Hard refresh to trigger server component reload
      window.location.reload();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-primary)', padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 800 }}>DataKeeper</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '3rem', textAlign: 'center', maxWidth: '600px' }}>
        Your personal and ephemeral virtual file system. Sign in to access your permanent drive, or enter a secret code to join a temporary 24-hour folder.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '400px' }}>
        
        {/* Permanent Drive */}
        <div style={{
          background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)'
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Permanent Drive</h2>
          <button 
            onClick={() => signIn('google')}
            style={{
              width: '100%', padding: '0.8rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '6px',
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Temporary Drive */}
        <div style={{
          background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)'
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>24-Hour Temporary Folder</h2>
          <form onSubmit={handleJoinSecret} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Enter Secret Code..." 
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              style={{
                width: '100%', padding: '0.8rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: '6px', color: 'var(--text-primary)', fontSize: '1rem'
              }}
            />
            <button 
              type="submit" 
              disabled={isLoading || !secretCode.trim()}
              style={{
                width: '100%', padding: '0.8rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none',
                borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: (isLoading || !secretCode.trim()) ? 0.7 : 1
              }}
            >
              {isLoading ? 'Joining...' : 'Join Folder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
