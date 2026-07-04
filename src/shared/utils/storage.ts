import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';

export interface StoredFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
}

export interface StorageProvider {
  save(file: Express.Multer.File, subdir?: string): Promise<StoredFile>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async save(file: Express.Multer.File, subdir = ''): Promise<StoredFile> {
    const dir = path.join(this.baseDir, subdir);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(dir, filename);

    await fs.writeFile(filePath, file.buffer);

    return {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: filePath,
      url: this.getUrl(path.join(subdir, filename)),
    };
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // file may not exist
    }
  }

  getUrl(relativePath: string): string {
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }
}

export const storage: StorageProvider = new LocalStorageProvider(env.UPLOAD_DIR);
