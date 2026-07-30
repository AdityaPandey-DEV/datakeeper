'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type FileItem } from '@/lib/blob';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { FileList, type SortConfig, type SortColumn } from './FileList';
import { UploadArea } from './UploadArea';
import { NewFolderDialog } from './NewFolderDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { MoveDialog } from './MoveDialog';
import { FilePreview } from './FilePreview';
import { AIOrganizeDialog, type AIMove } from './AIOrganizeDialog';

interface FileBrowserProps {
  initialPath: string;
}

export function FileBrowser({ initialPath }: FileBrowserProps) {
  const router = useRouter();
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Search and Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'name', direction: 'asc' });

  // Dialog states
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isBulkMove, setIsBulkMove] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  // AI Organize state
  const [isAIOrganizeOpen, setIsAIOrganizeOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiMoves, setAiMoves] = useState<AIMove[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/files', window.location.origin);
      url.searchParams.set('path', initialPath);
      if (debouncedSearch) {
        url.searchParams.set('search', debouncedSearch);
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [initialPath, debouncedSearch]);

  useEffect(() => {
    fetchFiles();
    setSelectedItems(new Set());
  }, [fetchFiles]);

  const processedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      // Always put folders first, unless searching (where folders might not even be returned depending on search criteria)
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      let comparison = 0;
      switch (sortConfig.column) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          const sizeA = a.size || 0;
          const sizeB = b.size || 0;
          comparison = sizeA - sizeB;
          break;
        case 'date':
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [items, sortConfig]);

  const handleSort = (column: SortColumn) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Selection handlers
  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const all = new Set(processedItems.map(item => item.type === 'file' ? item.url! : item.path));
      setSelectedItems(all);
    } else {
      setSelectedItems(new Set());
    }
  };

  // Create folder
  const handleCreateFolder = async (name: string) => {
    setIsOperating(true);
    try {
      const folderPath = initialPath ? `${initialPath}/${name}` : name;
      await fetch('/api/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
      await fetchFiles();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsOperating(false);
    }
  };

  // Delete single item
  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setIsOperating(true);
    try {
      if (deleteTarget.type === 'file') {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: deleteTarget.url, id: deleteTarget.id }),
        });
      } else {
        await fetch('/api/folder', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: deleteTarget.path, id: deleteTarget.id }),
        });
      }
      setDeleteTarget(null);
      setSelectedItems(new Set());
      await fetchFiles();
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setIsOperating(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setIsOperating(true);
    try {
      for (const id of selectedItems) {
        const item = processedItems.find(i => (i.type === 'file' ? i.url : i.path) === id);
        if (!item) continue;

        if (item.type === 'file') {
          await fetch('/api/files', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, id: item.id }),
          });
        } else {
          await fetch('/api/folder', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: item.path, id: item.id }),
          });
        }
      }
      setSelectedItems(new Set());
      setIsBulkDelete(false);
      await fetchFiles();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    } finally {
      setIsOperating(false);
    }
  };

  // Move single item
  const handleMoveItem = async (destinationPath: string) => {
    if (!moveTarget) return;
    setIsOperating(true);
    try {
      if (moveTarget.type === 'file') {
        const destPath = destinationPath
          ? `${destinationPath}/${moveTarget.name}`
          : moveTarget.name;
        await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move-file',
            id: moveTarget.id,
            sourceUrl: moveTarget.url,
            destinationPath: destPath,
          }),
        });
      } else {
        const destPath = destinationPath
          ? `${destinationPath}/${moveTarget.name}`
          : moveTarget.name;
        await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move-folder',
            id: moveTarget.id,
            sourcePath: moveTarget.path,
            destinationPath: destPath,
          }),
        });
      }
      setMoveTarget(null);
      setSelectedItems(new Set());
      await fetchFiles();
    } catch (error) {
      console.error('Failed to move:', error);
    } finally {
      setIsOperating(false);
    }
  };

  // Bulk move
  const handleBulkMove = async (destinationPath: string) => {
    setIsOperating(true);
    try {
      for (const id of selectedItems) {
        const item = processedItems.find(i => (i.type === 'file' ? i.url : i.path) === id);
        if (!item) continue;

        if (item.type === 'file') {
          const destPath = destinationPath
            ? `${destinationPath}/${item.name}`
            : item.name;
          await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'move-file',
              id: item.id,
              sourceUrl: item.url,
              destinationPath: destPath,
            }),
          });
        } else {
          const destPath = destinationPath
            ? `${destinationPath}/${item.name}`
            : item.name;
          await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'move-folder',
              id: item.id,
              sourcePath: item.path,
              destinationPath: destPath,
            }),
          });
        }
      }
      setSelectedItems(new Set());
      setIsBulkMove(false);
      await fetchFiles();
    } catch (error) {
      console.error('Failed to bulk move:', error);
    } finally {
      setIsOperating(false);
    }
  };

  // Rename
  const handleRenameItem = async (item: FileItem, newName: string) => {
    if (item.type !== 'file') return;
    setIsOperating(true);
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          id: item.id,
          sourceUrl: item.url,
          sourcePath: item.path,
          newName,
        }),
      });
      await fetchFiles();
    } catch (error) {
      console.error('Failed to rename:', error);
    } finally {
      setIsOperating(false);
    }
  };

  const handleAIOrganizeClick = async () => {
    setIsAIOrganizeOpen(true);
    setIsAILoading(true);
    setAiMoves([]);
    setAiError(null);
    try {
      const res = await fetch('/api/organize/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: initialPath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Failed to generate plan.');
      } else if (data.moves) {
        setAiMoves(data.moves);
      }
    } catch (err: any) {
      console.error('Failed to get AI plan:', err);
      setAiError(err.message || 'Network error.');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleAIOrganizeConfirm = async () => {
    try {
      await fetch('/api/organize/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: aiMoves }),
      });
      setIsAIOrganizeOpen(false);
      await fetchFiles();
    } catch (err) {
      console.error('Failed to execute AI plan:', err);
    }
  };

  return (
    <div className="file-browser">
      <Breadcrumb path={initialPath} />

      <div className="browser-divider" />

      <Toolbar
        onNewFolder={() => setShowNewFolder(true)}
        onUpload={() => uploadInputRef.current?.click()}
        onAIOrganize={handleAIOrganizeClick}
        selectedCount={selectedItems.size}
        onMoveSelected={() => setIsBulkMove(true)}
        onDeleteSelected={() => setIsBulkDelete(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {isOperating && (
        <div className="operation-bar">
          <div className="loading-spinner loading-spinner-sm" />
          <span>Processing...</span>
        </div>
      )}

      <FileList
        items={processedItems}
        selectedItems={selectedItems}
        onSelectItem={handleSelectItem}
        onSelectAll={handleSelectAll}
        onDeleteItem={(item) => setDeleteTarget(item)}
        onMoveItem={(item) => setMoveTarget(item)}
        onRenameItem={handleRenameItem}
        onPreviewItem={(item) => setPreviewTarget(item)}
        isLoading={isLoading}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <UploadArea
        currentPath={initialPath}
        onUploadComplete={fetchFiles}
        inputRef={uploadInputRef}
      />

      {/* Dialogs */}
      <NewFolderDialog
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onConfirm={handleCreateFolder}
      />

      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name || ''}
        itemType={deleteTarget?.type || 'file'}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
      />

      <DeleteConfirmDialog
        isOpen={isBulkDelete}
        itemName={`${selectedItems.size} items`}
        itemType="file"
        onClose={() => setIsBulkDelete(false)}
        onConfirm={handleBulkDelete}
      />

      <MoveDialog
        isOpen={!!moveTarget}
        itemName={moveTarget?.name || ''}
        itemType={moveTarget?.type || 'file'}
        currentPath={initialPath}
        onClose={() => setMoveTarget(null)}
        onConfirm={handleMoveItem}
      />

      <MoveDialog
        isOpen={isBulkMove}
        itemName={`${selectedItems.size} items`}
        itemType="file"
        currentPath={initialPath}
        onClose={() => setIsBulkMove(false)}
        onConfirm={handleBulkMove}
      />

      <FilePreview
        isOpen={!!previewTarget}
        fileName={previewTarget?.name || ''}
        fileUrl={previewTarget?.url || ''}
        onClose={() => setPreviewTarget(null)}
      />

      <AIOrganizeDialog
        isOpen={isAIOrganizeOpen}
        isLoading={isAILoading}
        moves={aiMoves}
        error={aiError}
        onClose={() => setIsAIOrganizeOpen(false)}
        onConfirm={handleAIOrganizeConfirm}
        currentPath={initialPath}
      />
    </div>
  );
}
