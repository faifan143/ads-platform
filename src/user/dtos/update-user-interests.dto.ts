import { IsArray, IsUUID } from 'class-validator';

// src/user/dtos/update-user-interests.dto.ts
export class UpdateUserInterestsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}
