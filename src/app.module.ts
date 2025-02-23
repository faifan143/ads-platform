import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { InterestModule } from './interest/interest.module';
import { ProductModule } from './product/product.module';
import { ContentModule } from './content/content.module';
import { UserModule } from './user/user.module';
import { FileManagementModule } from './file-management/file-management.module';

@Module({
  imports: [
    // Load and validate environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
        const missingVars = requiredVars.filter((key) => !env[key]);
        if (missingVars.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missingVars.join(', ')}`,
          );
        }
        return env;
      },
    }),
    PrismaModule,
    AuthModule,
    InterestModule,
    ProductModule,
    ContentModule,
    UserModule,
    FileManagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [PrismaModule],
})
export class AppModule {}
