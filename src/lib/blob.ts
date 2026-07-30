import { list, put, del, copy } from '@vercel/blob';

/**
 * Get the Blob token from environment variables.
 * Supports both BLOB_READ_WRITE_TOKEN and VERCEL_BLOB_READ_WRITE_TOKEN.
 */
function getToken(): string {
  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'Missing BLOB_READ_WRITE_TOKEN. Please add it to your Vercel project environment variables.'
    );
  }
  return token;
}

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  url?: string;
  size?: number;
  uploadedAt?: Date;
  contentType?: string;
}

/**
 * List all files and folders at a given path prefix.
 * Parses Vercel Blob's flat namespace into a folder structure.
 */
export async function listFolder(prefix: string): Promise<FileItem[]> {
  const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : prefix + '/') : '';

  const items: FileItem[] = [];
  const seenFolders = new Set<string>();

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await list({
      prefix: normalizedPrefix,
      cursor,
      limit: 1000,
      token: getToken(),
    });

    for (const blob of response.blobs) {
      // Get the relative path after the prefix
      const relativePath = blob.pathname.slice(normalizedPrefix.length);

      if (!relativePath) continue;

      // Check if this blob is in a subfolder
      const slashIndex = relativePath.indexOf('/');

      if (slashIndex !== -1) {
        // This is inside a subfolder
        const folderName = relativePath.slice(0, slashIndex);
        const folderPath = normalizedPrefix + folderName;

        if (!seenFolders.has(folderPath)) {
          seenFolders.add(folderPath);
          items.push({
            name: folderName,
            type: 'folder',
            path: folderPath,
          });
        }
      } else {
        // This is a direct file in this folder
        // Skip .keep files (folder markers)
        if (relativePath === '.keep') continue;

        items.push({
          name: relativePath,
          type: 'file',
          path: blob.pathname,
          url: blob.url,
          size: blob.size,
          uploadedAt: new Date(blob.uploadedAt),
          contentType: undefined,
        });
      }
    }

    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  // Sort: folders first, then files, both alphabetically
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return items;
}

/**
 * Upload a file to a specific path in the blob store.
 */
export async function uploadFile(
  path: string,
  file: File | Blob,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  const blob = await put(path, file, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token: getToken(),
  });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Delete a file by its URL.
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url, { token: getToken() });
}

/**
 * Delete multiple files by their URLs.
 */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await del(urls, { token: getToken() });
}

/**
 * Create a folder by placing a hidden .keep marker file.
 */
export async function createFolder(path: string): Promise<void> {
  const folderPath = path.endsWith('/') ? path : path + '/';
  await put(folderPath + '.keep', new Blob(['']), {
    access: 'public',
    addRandomSuffix: false,
    token: getToken(),
  });
}

/**
 * Delete a folder and all its contents recursively.
 */
export async function deleteFolder(prefix: string): Promise<void> {
  const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
  const urls: string[] = [];

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await list({
      prefix: normalizedPrefix,
      cursor,
      limit: 1000,
      token: getToken(),
    });

    for (const blob of response.blobs) {
      urls.push(blob.url);
    }

    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  if (urls.length > 0) {
    // Delete in batches of 1000
    for (let i = 0; i < urls.length; i += 1000) {
      await del(urls.slice(i, i + 1000), { token: getToken() });
    }
  }
}

/**
 * Move a file from one path to another (copy + delete).
 */
export async function moveFile(
  sourceUrl: string,
  destinationPath: string
): Promise<{ url: string; pathname: string }> {
  const blob = await copy(sourceUrl, destinationPath, {
    access: 'public',
    addRandomSuffix: false,
    token: getToken(),
  });

  await del(sourceUrl, { token: getToken() });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Move an entire folder to a new location.
 */
export async function moveFolder(
  sourcePrefix: string,
  destinationPrefix: string
): Promise<void> {
  const normalizedSource = sourcePrefix.endsWith('/') ? sourcePrefix : sourcePrefix + '/';
  const normalizedDest = destinationPrefix.endsWith('/') ? destinationPrefix : destinationPrefix + '/';

  let cursor: string | undefined;
  let hasMore = true;
  const operations: { url: string; newPath: string }[] = [];

  while (hasMore) {
    const response = await list({
      prefix: normalizedSource,
      cursor,
      limit: 1000,
      token: getToken(),
    });

    for (const blob of response.blobs) {
      const relativePath = blob.pathname.slice(normalizedSource.length);
      operations.push({
        url: blob.url,
        newPath: normalizedDest + relativePath,
      });
    }

    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  // Copy all files to new location
  for (const op of operations) {
    await copy(op.url, op.newPath, {
      access: 'public',
      addRandomSuffix: false,
      token: getToken(),
    });
  }

  // Delete all old files
  const urls = operations.map(op => op.url);
  for (let i = 0; i < urls.length; i += 1000) {
    await del(urls.slice(i, i + 1000), { token: getToken() });
  }
}

/**
 * Rename a file (move to same folder with new name).
 */
export async function renameFile(
  sourceUrl: string,
  sourcePath: string,
  newName: string
): Promise<{ url: string; pathname: string }> {
  const lastSlash = sourcePath.lastIndexOf('/');
  const parentPath = lastSlash !== -1 ? sourcePath.slice(0, lastSlash + 1) : '';
  const destinationPath = parentPath + newName;

  return moveFile(sourceUrl, destinationPath);
}

/**
 * Get all folder paths for the move dialog tree.
 */
export async function getAllFolders(): Promise<string[]> {
  const folders = new Set<string>();
  folders.add(''); // root

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await list({ cursor, limit: 1000, token: getToken() });

    for (const blob of response.blobs) {
      const parts = blob.pathname.split('/');
      // Build all parent folder paths
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }

    hasMore = response.hasMore;
    cursor = response.cursor;
  }

  return Array.from(folders).sort();
}

/**
 * Get file extension from a filename.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Get file type category from extension.
 */
export function getFileCategory(filename: string): string {
  const ext = getFileExtension(filename);
  const categories: Record<string, string[]> = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
    video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    pdf: ['pdf'],
    document: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'],
    text: ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'ini', 'cfg'],
    code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'css', 'html', 'sql', 'sh', 'bash', 'rb', 'go', 'rs', 'swift', 'kt'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) return category;
  }
  return 'other';
}

/**
 * Format file size to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
