'use client';

import { getFileCategory } from '@/lib/blob';

interface FilePreviewProps {
  isOpen: boolean;
  fileName: string;
  fileUrl: string;
  onClose: () => void;
}

export function FilePreview({ isOpen, fileName, fileUrl, onClose }: FilePreviewProps) {
  if (!isOpen) return null;

  const category = getFileCategory(fileName);

  const renderPreview = () => {
    switch (category) {
      case 'image':
        return (
          <div className="preview-image-container">
            <img src={fileUrl} alt={fileName} className="preview-image" />
          </div>
        );
      case 'video':
        return (
          <video controls className="preview-video" autoPlay={false}>
            <source src={fileUrl} />
            Your browser does not support the video tag.
          </video>
        );
      case 'audio':
        return (
          <div className="preview-audio-container">
            <div className="preview-audio-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <audio controls className="preview-audio" autoPlay={false}>
              <source src={fileUrl} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );
      case 'pdf':
        return (
          <iframe
            src={fileUrl}
            className="preview-pdf"
            title={fileName}
          />
        );
      default:
        return (
          <div className="preview-unsupported">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>Preview not available for this file type</p>
            <a href={fileUrl} download={fileName} className="preview-download-btn">
              Download File
            </a>
          </div>
        );
    }
  };

  return (
    <div className="dialog-overlay preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3 className="preview-title">{fileName}</h3>
          <div className="preview-header-actions">
            <a
              href={fileUrl}
              download={fileName}
              className="action-btn"
              title="Download"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <button className="action-btn" onClick={onClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="preview-content">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
