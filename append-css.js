const fs = require('fs');

const newCSS = `

/* ======================================================
   Modern Move Dialog Styles
   ====================================================== */
.dialog-move-modern {
  width: 90%;
  max-width: 450px;
  max-height: 85vh;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.move-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.move-icon-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
}

.move-icon-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.move-icon-btn:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.move-confirm-btn {
  color: var(--accent) !important;
}

.move-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.move-breadcrumbs-container {
  padding: 12px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.move-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.move-breadcrumb-segment {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.move-breadcrumb-segment.active .move-breadcrumb-text {
  background: var(--accent-light);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.move-breadcrumb-text {
  cursor: pointer;
  padding: 4px 0;
}

.move-breadcrumb-separator {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.move-content {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
}

.move-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.move-folder-list-modern {
  display: flex;
  flex-direction: column;
}

.move-folder-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
}

.move-folder-row:hover {
  background: var(--bg-secondary);
}

.move-folder-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.move-folder-row-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.move-folder-row-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
}

.move-folder-row-meta {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.move-folder-row-chevron {
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
`;

fs.appendFileSync('src/app/globals.css', newCSS);
console.log('Appended CSS to globals.css');
