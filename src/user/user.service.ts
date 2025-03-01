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


    async getUserProfile(userId: string) {
    // Fetch the user with all related information
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        interests: true,
        contents: {
          include: {
            interests: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        likes: {
          include: {
            content: {
              include: {
                interests: true,
                owner: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        whatsappShares: {
          include: {
            content: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        productPurchases: {
          include: {
            product: true,
          },
          orderBy: {
            purchasedAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Calculate stats
    const totalContents = user.contents.length;
    const totalViews = user.contents.reduce((sum, content) => sum + content.viewsCount, 0);
    const totalClicks = user.contents.reduce((sum, content) => sum + content.clicksCount, 0);
    const totalLikes = await this.prisma.userContentLike.count({
      where: {
        content: {
          ownerId: userId,
        },
      },
    });
    const totalShares = await this.prisma.userContentWhatsApp.count({
      where: {
        content: {
          ownerId: userId,
        },
      },
    });

    // Get total earned points from content
    const earnedPoints = user.contents.reduce((sum, content) => sum + content.rewards, 0);
    
    // Get spent points from product purchases
    const spentPoints = user.productPurchases.reduce(
      (sum, purchase) => sum + purchase.product.pointsPrice,
      0
    );

    // Return structured profile data
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        birthDate: user.birthDate,
        points: user.points,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      stats: {
        totalContents,
        totalViews,
        totalClicks,
        totalLikes,
        totalShares,
        earnedPoints,
        spentPoints,
        currentPoints: user.points,
      },
      interests: user.interests,
      contents: user.contents.map(content => ({
        id: content.id,
        title: content.title,
        description: content.description,
        type: content.type,
        imageUrl: content.imageUrl,
        videoUrl: content.videoUrl,
        viewsCount: content.viewsCount,
        clicksCount: content.clicksCount,
        rewards: content.rewards,
        active: content.active,
        approved: content.approved,
        createdAt: content.createdAt,
        interests: content.interests,
      })),
      likedContents: user.likes.map(like => ({
        id: like.content.id,
        title: like.content.title,
        description: like.content.description,
        imageUrl: like.content.imageUrl,
        owner: {
          id: like.content.owner.id,
          name: like.content.owner.name,
        },
        likedAt: like.createdAt,
      })),
      sharedContents: user.whatsappShares.map(share => ({
        id: share.content.id,
        title: share.content.title,
        sharedAt: share.createdAt,
      })),
      purchases: user.productPurchases.map(purchase => ({
        id: purchase.id,
        product: {
          id: purchase.product.id,
          name: purchase.product.name,
          photo: purchase.product.photo,
          pointsPrice: purchase.product.pointsPrice,
        },
        purchasedAt: purchase.purchasedAt,
      })),
    };
  }

}
