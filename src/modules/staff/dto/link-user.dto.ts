import { IsNotEmpty, IsUUID } from 'class-validator';

export class LinkUserDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}

