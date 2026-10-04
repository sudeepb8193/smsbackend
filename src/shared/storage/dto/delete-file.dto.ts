import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Storage key is required for deletion' })
  key: string;
}
