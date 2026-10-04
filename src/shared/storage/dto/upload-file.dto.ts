import { IsEnum, IsOptional } from 'class-validator';
import { StorageFolder } from '../enums/storage-folder.enum';

export class UploadFileDto {
  @IsEnum(StorageFolder, {
    message: `Folder must be one of: ${Object.values(StorageFolder).join(', ')}`,
  })
  @IsOptional()
  folder?: StorageFolder = StorageFolder.GENERAL;
}
