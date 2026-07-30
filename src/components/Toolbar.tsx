'use client';

interface ToolbarProps {
  onNewFolder: () => void;
  onUpload: () => void;
  selectedCount: number;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
}

export function Toolbar({
  onNewFolder,
  onUpload,
  selectedCount,
  onMoveSelected,
  onDeleteSelected,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn toolbar-btn-primary" onClick={onNewFolder}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          New Folder
        </button>
        <button className="toolbar-btn toolbar-btn-accent" onClick={onUpload}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          Upload
        </button>
      </div>
      {selectedCount > 0 && (
        <div className="toolbar-right">
          <span className="toolbar-selection-count">{selectedCount} selected</span>
          <button className="toolbar-btn toolbar-btn-secondary" onClick={onMoveSelected}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            Move
          </button>
          <button className="toolbar-btn toolbar-btn-danger" onClick={onDeleteSelected}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
