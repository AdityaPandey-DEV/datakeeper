'use client';

import { useRef, useState, useCallback } from 'react';

interface UploadAreaProps {
  inputRef?: React.RefObject<HTMLInputElement>;
  currentPath: string;
  onUploadComplete: () => void;
}

interface UploadProgress {
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadArea({ currentPath, onUploadComplete, inputRef }: UploadAreaProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const fileInputRef = inputRef || internalRef;
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    const initialProgress: UploadProgress[] = fileArray.map(f => ({
      name: f.name,
      progress: 0,
      status: 'uploading',
    }));
    setUploads(initialProgress);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const prefix = currentPath ? currentPath + '/' : '';
      const pathname = prefix + file.name;

      try {
        // 1. Get Presigned URL
        const presignRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: pathname, contentType: file.type })
        });
        
        if (!presignRes.ok) {
          const errData = await presignRes.json();
          throw new Error(errData.error || 'Failed to get upload URL');
        }

        const { url, key } = await presignRes.json();

        // 2. Upload directly to Cloudflare R2
        const uploadRes = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          }
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file to storage');
        }

        // 3. Log into Postgres
        const completeRes = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, size: file.size, clientPathname: pathname })
        });

        if (!completeRes.ok) {
          throw new Error('Failed to log file to database');
        }

        setUploads(prev =>
          prev.map((u, idx) =>
            idx === i ? { ...u, progress: 100, status: 'done' } : u
          )
        );
      } catch (error: any) {
        setUploads(prev =>
          prev.map((u, idx) =>
            idx === i
              ? { ...u, status: 'error', error: error.message }
              : u
          )
        );
      }
    }

    setIsUploading(false);

    // Refresh file list after a short delay
    setTimeout(() => {
      onUploadComplete();
      // Clear upload statuses after 3s
      setTimeout(() => setUploads([]), 3000);
    }, 500);
  }, [currentPath, onUploadComplete]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if we're actually leaving the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="upload-area-wrapper">
      {uploads.length > 0 && (
        <div className="upload-progress-list">
          {uploads.map((u, idx) => (
            <div key={idx} className={`upload-progress-item upload-${u.status}`}>
              <div className="upload-progress-info">
                <span className="upload-filename">{u.name}</span>
                <span className="upload-status">
                  {u.status === 'uploading' && 'Uploading...'}
                  {u.status === 'done' && '✓ Done'}
                  {u.status === 'error' && `✗ ${u.error || 'Failed'}`}
                </span>
              </div>
              {u.status === 'uploading' && (
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: '100%' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className={`upload-area ${isDragging ? 'upload-area-dragging' : ''} ${isUploading ? 'upload-area-disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="upload-input"
          disabled={isUploading}
        />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
        <p className="upload-text">
          {isDragging
            ? 'Drop files here to upload'
            : isUploading
            ? 'Uploading...'
            : '+ Upload Files — or drag & drop here'}
        </p>
      </div>
    </div>
  );
}
