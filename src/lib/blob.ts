import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Ensure the S3 client can be configured with environment variables
function getS3Client() {
  const accountId =
    process.env.R2_ENDPOINT?.split('https://')[1]?.split('.')[0];
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('Missing Cloudflare R2 environment variables.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME || 'datakeeper';
}

function getPublicUrl(key: string) {
  const baseUrl = process.env.R2_PUBLIC_URL || '';
  // Ensure base URL ends with a slash and key doesn't start with one
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const cleanKey = key.startsWith('/') ? key.substring(1) : key;
  // Encode the key parts but leave slashes intact
  const encodedKey = cleanKey.split('/').map(encodeURIComponent).join('/');
  return cleanBaseUrl + encodedKey;
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
 */
export async function listFolder(prefix: string): Promise<FileItem[]> {
  const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : prefix + '/') : '';
  const items: FileItem[] = [];
  const s3 = getS3Client();
  const bucket = getBucketName();

  let continuationToken: string | undefined = undefined;

  do {
    const command: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: normalizedPrefix,
      Delimiter: '/', // Delimiter makes S3 group items into common prefixes (folders)
      ContinuationToken: continuationToken,
    });

    const response: any = await s3.send(command);

    // Add folders (CommonPrefixes)
    if (response.CommonPrefixes) {
      for (const commonPrefix of response.CommonPrefixes) {
        if (!commonPrefix.Prefix) continue;
        const folderPath = commonPrefix.Prefix;
        // Get the folder name (part before the last slash)
        const name = folderPath.slice(normalizedPrefix.length, -1);
        
        items.push({
          name: name,
          type: 'folder',
          path: folderPath,
        });
      }
    }

    // Add files
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        const relativePath = obj.Key.slice(normalizedPrefix.length);

        // Skip root markers or .keep files
        if (relativePath === '' || relativePath === '.keep') continue;

        items.push({
          name: relativePath,
          type: 'file',
          path: obj.Key,
          url: getPublicUrl(obj.Key),
          size: obj.Size,
          uploadedAt: obj.LastModified,
          contentType: undefined, // ContentType isn't returned in ListObjectsV2 easily
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

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
  const s3 = getS3Client();
  const bucket = getBucketName();
  
  // Use Upload utility which handles multipart uploads transparently
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: path,
      Body: file,
      ContentType: contentType || file.type || 'application/octet-stream',
    },
  });

  await upload.done();

  return { url: getPublicUrl(path), pathname: path };
}

/**
 * Delete a file by its URL.
 * URL format: https://pub-xyz.r2.dev/path/to/file.mp4
 */
export async function deleteFile(url: string): Promise<void> {
  const baseUrl = process.env.R2_PUBLIC_URL || '';
  if (!url.startsWith(baseUrl)) return;
  
  const key = decodeURIComponent(url.slice(baseUrl.length + (baseUrl.endsWith('/') ? 0 : 1)));
  if (!key) return;

  const s3 = getS3Client();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })
  );
}

/**
 * Delete multiple files by their URLs.
 */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const baseUrl = process.env.R2_PUBLIC_URL || '';
  const s3 = getS3Client();
  const bucket = getBucketName();
  
  const keys = urls
    .filter(url => url.startsWith(baseUrl))
    .map(url => decodeURIComponent(url.slice(baseUrl.length + (baseUrl.endsWith('/') ? 0 : 1))))
    .filter(key => key.length > 0);

  if (keys.length === 0) return;

  // Batch delete in chunks of 1000 (S3 max limit per request)
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
        },
      })
    );
  }
}

/**
 * Create a folder by placing a hidden .keep marker file.
 */
export async function createFolder(path: string): Promise<void> {
  const folderPath = path.endsWith('/') ? path : path + '/';
  const s3 = getS3Client();
  
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: folderPath + '.keep',
      Body: '', // Empty body
    })
  );
}

/**
 * Delete a folder and all its contents recursively.
 */
export async function deleteFolder(prefix: string): Promise<void> {
  const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
  const s3 = getS3Client();
  const bucket = getBucketName();
  let continuationToken: string | undefined = undefined;

  do {
    const response: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents && response.Contents.length > 0) {
      const keys = response.Contents.map((obj: any) => obj.Key).filter((k: any) => k) as string[];
      
      // Batch delete
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map(key => ({ Key: key })),
            },
          })
        );
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
}

/**
 * Move a file from one path to another (copy + delete).
 */
export async function moveFile(
  sourceUrl: string,
  destinationPath: string
): Promise<{ url: string; pathname: string }> {
  const baseUrl = process.env.R2_PUBLIC_URL || '';
  if (!sourceUrl.startsWith(baseUrl)) throw new Error('Invalid source URL');
  
  const sourceKey = decodeURIComponent(sourceUrl.slice(baseUrl.length + (baseUrl.endsWith('/') ? 0 : 1)));
  const s3 = getS3Client();
  const bucket = getBucketName();

  // Copy
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(sourceKey)}`,
      Key: destinationPath,
    })
  );

  // Delete
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    })
  );

  return { url: getPublicUrl(destinationPath), pathname: destinationPath };
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
  
  const s3 = getS3Client();
  const bucket = getBucketName();
  let continuationToken: string | undefined = undefined;

  do {
    const response: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedSource,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        const relativePath = obj.Key.slice(normalizedSource.length);
        const destinationPath = normalizedDest + relativePath;

        // Copy
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${encodeURIComponent(obj.Key)}`,
            Key: destinationPath,
          })
        );

        // Delete
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: obj.Key,
          })
        );
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
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

  const s3 = getS3Client();
  const bucket = getBucketName();
  let continuationToken: string | undefined = undefined;

  do {
    const response: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        const parts = obj.Key.split('/');
        // Build all parent folder paths
        for (let i = 1; i < parts.length; i++) {
          const folderPath = parts.slice(0, i).join('/');
          folders.add(folderPath);
        }
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

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
