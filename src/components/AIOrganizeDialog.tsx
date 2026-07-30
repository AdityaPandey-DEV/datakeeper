'use client';

import { useState } from 'react';

export interface AIMove {
  old_path: string;
  new_path: string;
}

interface AIOrganizeDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  moves: AIMove[];
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  currentPath: string;
}

export function AIOrganizeDialog({
  isOpen,
  isLoading,
  moves,
  error,
  onClose,
  onConfirm,
  currentPath,
}: AIOrganizeDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsExecuting(true);
    await onConfirm();
    setIsExecuting(false);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">
            <span style={{ marginRight: '8px' }}>✨</span>
            AI Organization Plan
          </h2>
          <button className="dialog-close" onClick={onClose} disabled={isExecuting}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="dialog-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }} />
              <p>Gemini AI is analyzing your files...</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                Looking at {currentPath || 'root'} and all child folders.
              </p>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>
              <p style={{ fontWeight: 600 }}>Error Generating Plan</p>
              <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>{error}</p>
            </div>
          ) : moves.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>✨ Gemini thinks your files are already perfectly organized!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '8px' }}>
                Gemini proposes creating the following folder structure to organize your files:
              </p>
              {moves.map((move, i) => (
                <div key={i} style={{ 
                  background: 'var(--bg-tertiary)', 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ color: 'var(--red)', marginBottom: '4px', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>-</span>
                    <span style={{ wordBreak: 'break-all' }}>{move.old_path}</span>
                  </div>
                  <div style={{ color: 'var(--green, #4CAF50)', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>+</span>
                    <span style={{ wordBreak: 'break-all', fontWeight: '500' }}>{move.new_path}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            className="dialog-btn dialog-btn-secondary"
            onClick={onClose}
            disabled={isExecuting}
          >
            {moves.length === 0 && !isLoading ? 'Close' : 'Cancel'}
          </button>
          {!isLoading && moves.length > 0 && (
            <button
              className="dialog-btn dialog-btn-primary"
              onClick={handleConfirm}
              disabled={isExecuting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)' }}
            >
              {isExecuting && <div className="loading-spinner loading-spinner-sm" style={{ borderTopColor: 'white' }} />}
              Confirm & Organize
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
