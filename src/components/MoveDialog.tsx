'use client';

import { useState, useEffect, useMemo } from 'react';

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
  const [viewPath, setViewPath] = useState<string>('');
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
          const allFolders = data.folders || [];
          setFolders(allFolders);
          if (currentPath && allFolders.includes(currentPath)) {
            setViewPath(currentPath);
          } else if (allFolders.length > 0) {
            setViewPath(allFolders[0]);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, currentPath]);

  const childFolders = useMemo(() => {
    if (!viewPath) return [];
    return folders.filter(f => {
      if (f === viewPath) return false;
      if (!f.startsWith(viewPath + '/')) return false;
      const remaining = f.substring(viewPath.length + 1);
      return !remaining.includes('/');
    });
  }, [folders, viewPath]);

  const rootFolder = useMemo(() => {
    return folders.find(f => !f.includes('/')) || (folders.length > 0 ? folders[0] : '');
  }, [folders]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(viewPath);
    onClose();
  };

  const handleBack = () => {
    if (viewPath && viewPath !== rootFolder) {
      const lastSlash = viewPath.lastIndexOf('/');
      if (lastSlash > 0) {
        setViewPath(viewPath.substring(0, lastSlash));
      } else {
        setViewPath(rootFolder);
      }
    }
  };

  const breadcrumbs = viewPath ? viewPath.split('/') : [];
  
  const breadcrumbNodes = breadcrumbs.map((part, index) => {
    const fullPath = breadcrumbs.slice(0, index + 1).join('/');
    const isLast = index === breadcrumbs.length - 1;
    return (
      <span key={fullPath} className={`move-breadcrumb-segment ${isLast ? 'active' : ''}`}>
        <span 
          className="move-breadcrumb-text" 
          onClick={() => setViewPath(fullPath)}
        >
          {index === 0 ? 'Internal storage' : part}
        </span>
        {!isLast && <span className="move-breadcrumb-separator">{'>'}</span>}
      </span>
    );
  });

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-move-modern" onClick={(e) => e.stopPropagation()}>
        
        <div className="move-header">
          <button 
            className="move-icon-btn" 
            onClick={handleBack} 
            disabled={viewPath === rootFolder || !viewPath}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <h3 className="move-title">Move to...</h3>
          
          <button 
            className="move-icon-btn move-confirm-btn" 
            onClick={handleConfirm}
            disabled={isLoading || viewPath === currentPath}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>

        <div className="move-breadcrumbs-container">
          <div className="move-breadcrumbs">
            {breadcrumbNodes}
          </div>
        </div>

        <div className="move-content">
          {isLoading ? (
            <div className="dialog-loading">
              <div className="loading-spinner" />
              <p>Loading folders...</p>
            </div>
          ) : childFolders.length === 0 ? (
            <div className="move-empty">
              <p>No folders here</p>
            </div>
          ) : (
            <div className="move-folder-list-modern">
              {childFolders.map((folder) => {
                const folderName = folder.substring(viewPath.length + 1);
                return (
                  <div
                    key={folder}
                    className="move-folder-row"
                    onClick={() => setViewPath(folder)}
                  >
                    <div className="move-folder-row-icon">
                      <svg width="28" height="28" viewBox="0 0 16 16" className="file-icon file-icon-folder">
                        <path
                          fill="#FFC107"
                          d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3m-8.322.12q.322-.119.684-.12h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981z"
                        />
                      </svg>
                    </div>
                    <div className="move-folder-row-info">
                      <div className="move-folder-row-name">{folderName}</div>
                      <div className="move-folder-row-meta">Subfolder</div>
                    </div>
                    <div className="move-folder-row-chevron">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
