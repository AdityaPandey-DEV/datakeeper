'use client';

import { useState, useEffect } from 'react';

interface MoveDialogProps {
  isOpen: boolean;
  itemName: string;
  itemType: 'file' | 'folder';
  currentPath: string;
  onClose: () => void;
  onConfirm: (destinationPath: string) => void;
}

export function MoveDialog({
  isOpen,
  itemName,
  itemType,
  currentPath,
  onClose,
  onConfirm,
}: MoveDialogProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-folders' }),
      })
        .then(res => res.json())
        .then(data => {
          setFolders(data.folders || []);
          setSelectedFolder('');
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedFolder);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-move" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">
          Move {itemType}: <span className="dialog-item-name">{itemName}</span>
        </h3>
        <p className="dialog-message">Select destination folder:</p>

        {isLoading ? (
          <div className="dialog-loading">
            <div className="loading-spinner" />
            <p>Loading folders...</p>
          </div>
        ) : (
          <div className="move-folder-list">
            {folders.map((folder) => {
              const displayName = folder === '' ? '/ (Root)' : '/ ' + folder;
              const isCurrentParent = folder === currentPath;
              return (
                <button
                  key={folder}
                  className={`move-folder-item ${selectedFolder === folder ? 'move-folder-selected' : ''} ${isCurrentParent ? 'move-folder-current' : ''}`}
                  onClick={() => setSelectedFolder(folder)}
                  disabled={isCurrentParent}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" className="move-folder-icon">
                    <path
                      fill="currentColor"
                      d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3m-8.322.12q.322-.119.684-.12h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981z"
                    />
                  </svg>
                  <span>{displayName}</span>
                  {isCurrentParent && <span className="move-current-label">(current)</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dialog-btn dialog-btn-confirm"
            onClick={handleConfirm}
            disabled={isLoading || selectedFolder === currentPath}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
