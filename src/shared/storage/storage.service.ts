import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { StorageFolder } from './enums/storage-folder.enum';
import { UploadedFileResponse } from './interfaces/uploaded-file.interface';
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
} from './storage.constants';
import { generateStorageKey } from './utils/file-name.util';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly isPlaceholderCreds: boolean;
  private readonly uploadsDir: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>('B2_BUCKET_NAME') || 'sms-storage';

    const keyId = this.configService.get<string>('B2_KEY_ID') || '';
    const applicationKey =
      this.configService.get<string>('B2_APPLICATION_KEY') || '';
    const region =
      this.configService.get<string>('B2_REGION') || 'us-west-004';
    const endpoint = this.configService.get<string>('B2_ENDPOINT');

    this.isPlaceholderCreds =
      !keyId ||
      !applicationKey ||
      keyId.includes('your_backblaze') ||
      applicationKey.includes('your_backblaze');

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
      forcePathStyle: true,
    });

    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Validate uploaded file payload against size and MIME type criteria
   */
  public validateImageFile(file?: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'MISSING_FILE',
        message: 'No file was uploaded or file content is empty',
      });
    }

    if (file.size === 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'Uploaded file cannot be empty',
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the 5 MB maximum limit (Received ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB)`,
      });
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MIME_TYPE',
        message: `Unsupported file type: "${
          file.mimetype
        }". Allowed formats: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      });
    }
  }

  /**
   * Helper to write file to local disk under uploads/
   */
  private saveFileToLocalDisk(key: string, buffer: Buffer): void {
    const fullPath = path.join(this.uploadsDir, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    this.logger.log(`File saved to local storage fallback: ${fullPath}`);
  }

  /**
   * Upload an image file to Backblaze B2 (with graceful local fallback if B2 creds are unconfigured/offline)
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: StorageFolder = StorageFolder.GENERAL,
  ): Promise<UploadedFileResponse> {
    // 1. Validate File
    this.validateImageFile(file);

    // 2. Validate Folder Enum
    const validFolder = Object.values(StorageFolder).includes(folder)
      ? folder
      : StorageFolder.GENERAL;

    // 3. Generate Storage Key
    const { key, fileName } = generateStorageKey(
      validFolder,
      file.originalname,
    );

    // If credentials are placeholder values, save directly to local disk fallback
    if (this.isPlaceholderCreds) {
      this.logger.warn(
        `B2 credentials contain placeholder values. Saving file locally to uploads/${key}`,
      );
      this.saveFileToLocalDisk(key, file.buffer);
      return {
        key,
        fileName,
        originalName: file.originalname || fileName,
        mimeType: file.mimetype,
        size: file.size,
      };
    }

    try {
      // 4. Send PutObjectCommand to B2
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      this.logger.log(`Successfully uploaded file to B2: ${key}`);

      return {
        key,
        fileName,
        originalName: file.originalname || fileName,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (err: any) {
      this.logger.warn(
        `B2 Upload Error (${err?.name || err?.message}). Falling back to local storage for key "${key}"`,
      );
      try {
        this.saveFileToLocalDisk(key, file.buffer);
        return {
          key,
          fileName,
          originalName: file.originalname || fileName,
          mimeType: file.mimetype,
          size: file.size,
        };
      } catch (localErr) {
        this.logger.error(`Local fallback write failed:`, localErr);
        throw new InternalServerErrorException({
          code: 'STORAGE_UPLOAD_FAILED',
          message: 'Failed to upload file to cloud storage. Please try again later',
        });
      }
    }
  }

  /**
   * Delete an object from storage (local disk & Backblaze B2)
   */
  async deleteFile(key: string): Promise<{ success: boolean; message: string }> {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new BadRequestException({
        code: 'INVALID_STORAGE_KEY',
        message: 'Storage key is required for file deletion',
      });
    }

    const cleanKey = key.trim().replace(/^\/+/, '');

    // Check local disk file
    const localPath = path.join(this.uploadsDir, cleanKey);
    let deletedLocally = false;
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        deletedLocally = true;
        this.logger.log(`Deleted local storage file: ${localPath}`);
      } catch (err) {
        this.logger.error(`Failed to delete local storage file: ${localPath}`, err);
      }
    }

    if (this.isPlaceholderCreds) {
      return {
        success: true,
        message: 'File deleted successfully',
      };
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );

      this.logger.log(`Successfully deleted file from B2: ${cleanKey}`);

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (err: any) {
      if (deletedLocally) {
        return {
          success: true,
          message: 'File deleted successfully',
        };
      }
      this.logger.error(`B2 Delete Failure for key "${cleanKey}":`, err?.stack || err);
      throw new InternalServerErrorException({
        code: 'STORAGE_DELETE_FAILED',
        message: 'Failed to delete file from cloud storage',
      });
    }
  }

  /**
   * Get object stream and metadata (checks local fallback disk first, then B2)
   */
  async getFile(key: string) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new BadRequestException({
        code: 'INVALID_STORAGE_KEY',
        message: 'Storage key is required',
      });
    }

    const cleanKey = key.trim().replace(/^\/+/, '');
    const localPath = path.join(this.uploadsDir, cleanKey);

    // 1. If stored locally, serve local stream
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.gif') contentType = 'image/gif';

      return {
        body: fs.createReadStream(localPath),
        contentType,
        contentLength: stats.size,
      };
    }

    if (this.isPlaceholderCreds) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'The requested file does not exist in storage',
      });
    }

    // 2. Fetch from B2
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );

      return {
        body: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
      };
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException({
          code: 'FILE_NOT_FOUND',
          message: 'The requested file does not exist in storage',
        });
      }
      this.logger.error(`B2 GetFile Failure for key "${cleanKey}":`, err?.stack || err);
      throw new InternalServerErrorException({
        code: 'STORAGE_GET_FAILED',
        message: 'Failed to retrieve file from cloud storage',
      });
    }
  }

  /**
   * Check if an object exists in storage
   */
  async fileExists(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string' || key.trim() === '') return false;

    const cleanKey = key.trim().replace(/^\/+/, '');
    const localPath = path.join(this.uploadsDir, cleanKey);

    if (fs.existsSync(localPath)) return true;
    if (this.isPlaceholderCreds) return false;

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );
      return true;
    } catch (err: any) {
      return false;
    }
  }
}
