import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageFolder } from './enums/storage-folder.enum';
import { MAX_FILE_SIZE_BYTES } from './storage.constants';

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'B2_BUCKET_NAME':
          return 'test-bucket';
        case 'B2_KEY_ID':
          return 'test-key-id';
        case 'B2_APPLICATION_KEY':
          return 'test-app-key';
        case 'B2_REGION':
          return 'us-west-004';
        case 'B2_ENDPOINT':
          return 'https://s3.us-west-004.backblazeb2.com';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateImageFile', () => {
    it('should pass validation for valid JPEG image under 5MB', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1 MB
        buffer: Buffer.from('mock content'),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(mockFile)).not.toThrow();
    });

    it('should pass validation for valid PNG image under 5MB', () => {
      const mockFile = {
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 2 * 1024 * 1024, // 2 MB
        buffer: Buffer.from('mock png'),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(mockFile)).not.toThrow();
    });

    it('should pass validation for valid WebP image', () => {
      const mockFile = {
        originalname: 'banner.webp',
        mimetype: 'image/webp',
        size: 500 * 1024, // 500 KB
        buffer: Buffer.from('mock webp'),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(mockFile)).not.toThrow();
    });

    it('should throw BadRequestException if file is missing or null', () => {
      expect(() => service.validateImageFile(undefined)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file is empty (size 0)', () => {
      const emptyFile = {
        originalname: 'empty.jpg',
        mimetype: 'image/jpeg',
        size: 0,
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(emptyFile)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file exceeds 5MB size limit', () => {
      const largeFile = {
        originalname: 'huge.jpg',
        mimetype: 'image/jpeg',
        size: MAX_FILE_SIZE_BYTES + 1, // 5MB + 1 byte
        buffer: Buffer.from('large'),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(largeFile)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported MIME type (e.g., pdf or exe)', () => {
      const pdfFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 500,
        buffer: Buffer.from('pdf content'),
      } as Express.Multer.File;

      expect(() => service.validateImageFile(pdfFile)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should throw BadRequestException if key is empty or invalid', async () => {
      await expect(service.deleteFile('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteFile('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('fileExists', () => {
    it('should return false for invalid or empty storage keys', async () => {
      const result = await service.fileExists('');
      expect(result).toBe(false);
    });
  });
});
