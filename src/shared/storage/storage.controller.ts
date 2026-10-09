import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { DeleteFileDto } from './dto/delete-file.dto';
import { StorageFolder } from './enums/storage-folder.enum';
import type { Response } from 'express';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload image file to Backblaze B2
   * POST /storage/upload
   */
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    const folder = dto.folder || StorageFolder.GENERAL;
    return this.storageService.uploadFile(file, folder);
  }

  /**
   * Delete file from Backblaze B2 by key
   * DELETE /storage
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Body() dto: DeleteFileDto) {
    const result = await this.storageService.deleteFile(dto.key);
    return {
      success: true,
      message: result.message,
    };
  }

  /**
   * Retrieve file stream from Backblaze B2 by key
   * GET /storage/file?key=...
   */
  @Get('file')
  async getFile(@Query('key') key: string, @Res() res: Response) {
    const fileResult = await this.storageService.getFile(key);

    res.setHeader('Content-Type', fileResult.contentType);
    if (fileResult.contentType === 'image/svg+xml') {
      res.setHeader(
        'Content-Security-Policy',
        "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    if (fileResult.contentLength) {
      res.setHeader('Content-Length', fileResult.contentLength.toString());
    }

    const bodyStream = fileResult.body as any;
    if (bodyStream && typeof bodyStream.pipe === 'function') {
      bodyStream.pipe(res);
    } else if (bodyStream && typeof bodyStream.transformToByteArray === 'function') {
      const byteArray = await bodyStream.transformToByteArray();
      res.send(Buffer.from(byteArray));
    } else if (fileResult.body) {
      res.send(fileResult.body);
    } else {
      res.end();
    }
  }
}
