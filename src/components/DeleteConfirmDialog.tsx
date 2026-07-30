'use client';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  itemName: string;
  itemType: 'file' | 'folder';
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  isOpen,
  itemName,
  itemType,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-danger" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-warning-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className="dialog-title">Delete {itemType}?</h3>
        <p className="dialog-message">
          Are you sure you want to delete <strong>{itemName}</strong>?
          {itemType === 'folder' && (
            <span className="dialog-message-sub">
              <br />This will delete all files and subfolders inside it. This action cannot be undone.
            </span>
          )}
          {itemType === 'file' && (
            <span className="dialog-message-sub">
              <br />This action cannot be undone.
            </span>
          )}
        </p>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
