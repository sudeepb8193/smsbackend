import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageFolder } from '../enums/storage-folder.enum';

export function generateStorageKey(
  folder: StorageFolder | string,
  originalFilename: string,
): { key: string; fileName: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Extract clean extension or default to .bin
  const rawExt = path.extname(originalFilename || '').toLowerCase();
  const ext = rawExt && /^\.[a-z0-9]+$/i.test(rawExt) ? rawExt : '.jpg';

  const uuid = randomUUID();
  const fileName = `${uuid}${ext}`;

  // Sanitize folder to prevent path traversal
  const sanitizedFolder = String(folder)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase() || 'general';

  const key = `${sanitizedFolder}/${year}/${month}/${fileName}`;

  return { key, fileName };
}
