// src/auth/types/responses.ts
import { Gender, Providence } from '@prisma/client';

interface InterestResponse {
  id: string;
  name: string;
}
// Common user response type used across multiple endpoints
interface UserResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  gender: Gender;
  providence: Providence;
  interests: InterestResponse[];
  points: number;
  adsPerMonth: number;
}

// Sign Up Response
export interface SignUpResponse {
  message: string;
  user: Omit<UserResponse, 'points' | 'adsPerMonth'>;
}

// Sign In Response
export interface SignInResponse {
  message: string;
  data: UserResponse;
}

// Sign Out Response
export interface SignOutResponse {
  message: string;
}

// Get Profile Response (Me endpoint)
export interface ProfileResponse {
  id: string;
  email: string;
  phone: string;
}

// Error Responses
export interface AuthErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
