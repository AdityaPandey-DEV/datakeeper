'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type FileItem } from '@/lib/blob';
import { getFileCategory, formatFileSize } from '@/lib/blob';

interface FileRowProps {
  item: FileItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onDelete: () => void;
  onMove: () => void;
  onRename: (newName: string) => void;
  onPreview: () => void;
}

function FileIcon({ item }: { item: FileItem }) {
  if (item.type === 'folder') {
    return (
      <svg width="32" height="32" viewBox="0 0 16 16" className="file-icon file-icon-folder">
        <path
          fill="currentColor"
          d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3m-8.322.12q.322-.119.684-.12h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981z"
        />
      </svg>
    );
  }

  const category = getFileCategory(item.name);
  const iconMap: Record<string, { color: string; label: string }> = {
    image: { color: '#4CAF50', label: 'IMG' },
    video: { color: '#E91E63', label: 'VID' },
    audio: { color: '#9C27B0', label: 'AUD' },
    pdf: { color: '#F44336', label: 'PDF' },
    document: { color: '#2196F3', label: 'DOC' },
    text: { color: '#607D8B', label: 'TXT' },
    code: { color: '#FF9800', label: 'CODE' },
    archive: { color: '#795548', label: 'ZIP' },
    other: { color: '#9E9E9E', label: 'FILE' },
  };

  const { color, label } = iconMap[category] || iconMap.other;

  return (
    <div className="file-icon-badge" style={{ backgroundColor: color }}>
      <span>{label}</span>
    </div>
  );
}

export function FileRow({
  item,
  isSelected,
  onSelect,
  onDelete,
  onMove,
  onRename,
  onPreview,
}: FileRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(item.name);

  const handleRenameSubmit = () => {
    if (renameName.trim() && renameName !== item.name) {
      onRename(renameName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setRenameName(item.name);
      setIsRenaming(false);
    }
  };

  const content = (
    <>
      <div className="file-row-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${item.name}`}
        />
      </div>
      <div className="file-row-icon">
        <FileIcon item={item} />
      </div>
      <div className="file-row-name">
        {isRenaming ? (
          <input
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            className="rename-input"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="file-name-text"
            style={{ cursor: item.type === "file" ? "pointer" : "inherit" }}
            onClick={(e) => {
              if (item.type === 'file') {
                e.preventDefault();
                e.stopPropagation();
                onPreview();
              }
            }}
          >
            {item.name}
          </span>
        )}
      </div>
      <div className="file-row-date">
        {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : '—'}
      </div>
      <div className="file-row-size">
        {item.type === 'file' && item.size !== undefined ? formatFileSize(item.size) : '—'}
      </div>
      <div className="file-row-actions" onClick={(e) => e.stopPropagation()}>
        {item.type === 'file' && (
          <>
            <button
              className="action-btn"
              onClick={onPreview}
              title="Preview"
              aria-label={`Preview ${item.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <a
              className="action-btn"
              href={item.url}
              download={item.name}
              title="Download"
              aria-label={`Download ${item.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </>
        )}
        <button
          className="action-btn"
          onClick={onMove}
          title="Move"
          aria-label={`Move ${item.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        {item.type === 'file' && (
          <button
            className="action-btn"
            onClick={() => setIsRenaming(true)}
            title="Rename"
            aria-label={`Rename ${item.name}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          className="action-btn action-btn-danger"
          onClick={onDelete}
          title="Delete"
          aria-label={`Delete ${item.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </>
  );

  if (item.type === 'folder') {
    return (
      <Link href={`/browse/${item.path}`} className="file-row">
        {content}
      </Link>
    );
  }

  return (
    <div className="file-row">
      {content}
    </div>
  );
}
