// src/auth/dtos/auth.dto.ts
import { Gender, Providence } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^09\d{8}$/, {
    message:
      'Phone number must start with 09 followed by 8 digits (e.g., 0912345678)',
  })
  phone: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: 'Invalid email format',
  })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
    },
  )
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsEnum(Providence)
  providence: Providence;

  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}

export class SignInDto {
  @IsString()
  @Matches(/^09\d{8}$/, {
    message:
      'Phone number must start with 09 followed by 8 digits (e.g., 0912345678)',
  })
  phone: string;

  @IsString()
  password: string;
}
