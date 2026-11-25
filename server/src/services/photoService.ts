import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PhotoKind } from '../schemas/express.js';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif'
};

export function photoDirForRecord(recordId: number, uploadDir = config.uploadDir) {
  return path.join(uploadDir, 'photos', String(recordId));
}

export function resolveStoredPhotoPath(recordId: number, storedName: string | null | undefined, uploadDir = config.uploadDir) {
  if (!storedName) return null;
  const dir = photoDirForRecord(recordId, uploadDir);
  const candidate = path.join(dir, path.basename(storedName));
  if (!candidate.startsWith(dir)) {
    throw new AppError(1001, 400, '非法图片路径');
  }
  return candidate;
}

export function extensionForMime(mime: string) {
  const ext = ALLOWED_MIME[mime.toLowerCase()];
  if (!ext) {
    throw new AppError(1001, 400, '仅支持 JPG/PNG/WebP/HEIC 图片');
  }
  return ext;
}

export function buildStoredPhotoName(kind: PhotoKind, mime: string) {
  return `${kind}${extensionForMime(mime)}`;
}

export function persistUploadedPhoto(
  recordId: number,
  kind: PhotoKind,
  tempPath: string,
  mime: string,
  uploadDir = config.uploadDir
) {
  const dir = photoDirForRecord(recordId, uploadDir);
  fs.mkdirSync(dir, { recursive: true });
  const storedName = buildStoredPhotoName(kind, mime);
  const dest = path.join(dir, storedName);

  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(`${kind}.`) && file !== storedName) {
      fs.unlinkSync(path.join(dir, file));
    }
  }

  fs.renameSync(tempPath, dest);
  return storedName;
}

export function deletePhotoFile(recordId: number, storedName: string | null | undefined, uploadDir = config.uploadDir) {
  const fullPath = resolveStoredPhotoPath(recordId, storedName, uploadDir);
  if (!fullPath) return;
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export function photoPublicRef(recordId: number, kind: PhotoKind, storedName: string | null | undefined) {
  if (!storedName) return '';
  return `/api/express/${recordId}/photos/${kind}`;
}

export function photoExportRef(recordId: number, storedName: string | null | undefined) {
  if (!storedName) return '';
  return `photos/${recordId}/${path.basename(storedName)}`;
}
