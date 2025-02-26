// src/auth/guards/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_KEY } from '../decorators/admin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If the route doesn't have the @Admin decorator, we don't need to check admin status
    if (!isAdmin) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Check if user exists and has id set to 'admin'
    if (!user || user.id !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
