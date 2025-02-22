// src/auth/types/current-user.type.ts
import { Gender, Providence } from '@prisma/client';

export type CurrentUserType = {
  id: string;
  email: string;
  name: string;
  phone: string;
  dateOfBirth: Date;
  gender: Gender;
  providence: Providence;
  adsPerMonth: number;
  points: number;
  createdAt: Date;
  updatedAt: Date;
};
