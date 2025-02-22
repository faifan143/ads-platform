// src/auth/types/jwt-payload.type.ts
export type JwtPayload = {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
};
