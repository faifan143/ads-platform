import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async addInterests(userId: string, interestIds: string[]) {
    try {
      await this.findById(userId);

      await this.verifyInterests(interestIds);

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          interests: {
            connect: interestIds.map((id) => ({ id })),
          },
        },
        include: {
          interests: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to add interests');
    }
  }

  async removeInterests(userId: string, interestIds: string[]) {
    try {
      await this.findById(userId);

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          interests: {
            disconnect: interestIds.map((id) => ({ id })),
          },
        },
        include: {
          interests: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to remove interests');
    }
  }

  async updateInterests(userId: string, interestIds: string[]) {
    try {
      await this.findById(userId);

      await this.verifyInterests(interestIds);

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          interests: {
            set: interestIds.map((id) => ({ id })),
          },
        },
        include: {
          interests: true,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to update interests');
    }
  }

  private async verifyInterests(interestIds: string[]) {
    const interests = await this.prisma.interest.findMany({
      where: {
        id: {
          in: interestIds,
        },
      },
    });

    if (interests.length !== interestIds.length) {
      throw new NotFoundException('One or more interests not found');
    }
  }
}
