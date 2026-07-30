'use client';

import { type FileItem } from '@/lib/blob';
import { FileRow } from './FileRow';

export type SortColumn = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: SortColumn;
  direction: SortDirection;
}

interface FileListProps {
  items: FileItem[];
  selectedItems: Set<string>;
  onSelectItem: (path: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDeleteItem: (item: FileItem) => void;
  onMoveItem: (item: FileItem) => void;
  onRenameItem: (item: FileItem, newName: string) => void;
  onPreviewItem: (item: FileItem) => void;
  isLoading: boolean;
  sortConfig: SortConfig;
  onSort: (column: SortColumn) => void;
}

export function FileList({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onDeleteItem,
  onMoveItem,
  onRenameItem,
  onPreviewItem,
  isLoading,
  sortConfig,
  onSort,
}: FileListProps) {
  const allSelected = items.length > 0 && items.every(item =>
    selectedItems.has(item.type === 'file' ? item.url! : item.path)
  );

  if (isLoading) {
    return (
      <div className="file-list-loading">
        <div className="loading-spinner" />
        <p>Loading files...</p>
      </div>
    );
  }

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortConfig.column !== column) return null;
    return (
      <span className="sort-indicator">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="file-list">
      {items.length > 0 && (
        <div className="file-list-header">
          <div className="file-row-checkbox">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onSelectAll(e.target.checked)}
              aria-label="Select all"
            />
          </div>
          <div className="file-row-icon" />
          <div className="file-row-name header-label sortable" onClick={() => onSort('name')}>
            Name <SortIndicator column="name" />
          </div>
          <div className="file-row-size header-label sortable" onClick={() => onSort('size')}>
            Size <SortIndicator column="size" />
          </div>
          <div className="file-row-actions header-label sortable" onClick={() => onSort('date')}>
            Date Modified <SortIndicator column="date" />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="file-list-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="empty-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p className="empty-title">This folder is empty</p>
          <p className="empty-subtitle">Upload files or create a new folder to get started</p>
        </div>
      ) : (
        <div className="file-list-items">
          {items.map((item) => (
            <FileRow
              key={item.type === 'file' ? item.url! : item.path}
              item={item}
              isSelected={selectedItems.has(
                item.type === 'file' ? item.url! : item.path
              )}
              onSelect={(checked) =>
                onSelectItem(
                  item.type === 'file' ? item.url! : item.path,
                  checked
                )
              }
              onDelete={() => onDeleteItem(item)}
              onMove={() => onMoveItem(item)}
              onRename={(newName) => onRenameItem(item, newName)}
              onPreview={() => onPreviewItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
