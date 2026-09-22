import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface FileUploadValidationOptions {
  maxSizeBytes?: number; // Default 5MB
  allowedMimeTypes?: string[];
}

export interface ExpressMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileStorageService {
  private readonly uploadRootDir = path.join(
    process.cwd(),
    'uploads',
    'organizations',
  );

  constructor() {
    this.ensureDirectoryExists(this.uploadRootDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Validate uploaded image file format and size limits
   */
  validateImageFile(
    file: ExpressMulterFile,
    options?: FileUploadValidationOptions,
  ) {
    const maxSize = options?.maxSizeBytes || 5 * 1024 * 1024; // 5 MB
    const allowedTypes = options?.allowedMimeTypes || [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/svg+xml',
    ];

    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'No file was uploaded',
      });
    }

    if (file.size > maxSize) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds maximum allowed limit of ${maxSize / (1024 * 1024)} MB`,
      });
    }

    if (!allowedTypes.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message:
          'Invalid file format. Only JPG, PNG, and SVG images are supported',
      });
    }
  }

  /**
   * Store uploaded logo or favicon asset safely
   */
  async saveAsset(
    file: ExpressMulterFile,
    assetType: 'logo' | 'favicon',
  ): Promise<string> {
    this.validateImageFile(file);

    const subDir = path.join(this.uploadRootDir, assetType);
    this.ensureDirectoryExists(subDir);

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `${assetType}-${Date.now()}-${randomUUID().substring(0, 8)}${ext}`;
    const filePath = path.join(subDir, filename);

    try {
      await fs.promises.writeFile(filePath, file.buffer);
      // Return web accessible relative path
      return `/uploads/organizations/${assetType}/${filename}`;
    } catch {
      throw new BadRequestException({
        code: 'FILE_WRITE_FAILED',
        message:
          'Failed to write uploaded asset to storage. Retaining previous asset',
      });
    }
  }
}
