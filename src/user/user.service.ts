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
        viewedAds: {
          include: {
            content: {
              include: {
                interests: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            viewedAt: 'desc',
          },
        },
        UserContentLike: {
          include: {
            content: true,
          },
          orderBy: {
            likedAt: 'desc',
          },
        },
        UserContentWhatsApp: {
          include: {
            content: true,
          },
          orderBy: {
            whatsappedAt: 'desc',
          },
        },
        ProductPurchase: {
          include: {
            product: true,
          },
          orderBy: {
            purchasedAt: 'desc',
          },
        },
        claimedGems: {
          include: {
            content: true,
          },
          orderBy: {
            claimedAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Calculate stats
    const totalViewedAds = user.viewedAds.length;

    // Count ads that the user has created (ownerNumber matches user.phone)
    const createdAdsCount = await this.prisma.content.count({
      where: {
        ownerNumber: user.phone,
      },
    });

    // Get the contents created by this user
    const createdContents = await this.prisma.content.findMany({
      where: {
        ownerNumber: user.phone,
      },
      include: {
        interests: true,
        gem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate total likes and shares for user's content
    const totalLikes = await this.prisma.userContentLike.count({
      where: {
        content: {
          ownerNumber: user.phone,
        },
      },
    });

    const totalShares = await this.prisma.userContentWhatsApp.count({
      where: {
        content: {
          ownerNumber: user.phone,
        },
      },
    });

    // Calculate views on user's content
    const totalViews = await this.prisma.userContent.count({
      where: {
        content: {
          ownerNumber: user.phone,
        },
      },
    });

    // Get spent points from product purchases
    const spentPoints = user.ProductPurchase.reduce(
      (sum, purchase) => sum + purchase.pointsSpent,
      0,
    );

    // Return structured profile data
    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        providence: user.providence,
        points: user.points,
        adsPerMonth: user.adsPerMonth,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      stats: {
        viewedAdsCount: totalViewedAds,
        createdAdsCount,
        totalViews,
        totalLikes,
        totalShares,
        spentPoints,
        currentPoints: user.points,
      },
      interests: user.interests,
      createdContents: createdContents.map((content) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        type: content.type,
        mediaUrls: content.mediaUrls,
        intervalHours: content.intervalHours,
        endValidationDate: content.endValidationDate,
        interests: content.interests,
        hasGem: !!content.gem,
        gemPoints: content.gem?.points || 0,
        createdAt: content.createdAt,
      })),
      viewedAds: user.viewedAds.map((viewed) => ({
        id: viewed.content.id,
        title: viewed.content.title,
        description: viewed.content.description,
        type: viewed.content.type,
        mediaUrls: viewed.content.mediaUrls,
        viewedAt: viewed.viewedAt,
      })),
      likedContents: user.UserContentLike.map((like) => ({
        id: like.content.id,
        title: like.content.title,
        description: like.content.description,
        mediaUrls: like.content.mediaUrls,
        ownerName: like.content.ownerName,
        likedAt: like.likedAt,
      })),
      sharedContents: user.UserContentWhatsApp.map((share) => ({
        id: share.content.id,
        title: share.content.title,
        mediaUrls: share.content.mediaUrls,
        whatsappedAt: share.whatsappedAt,
      })),
      purchases: user.ProductPurchase.map((purchase) => ({
        id: purchase.id,
        product: {
          id: purchase.product.id,
          name: purchase.product.name,
          photo: purchase.product.photo,
          pointsPrice: purchase.product.pointsPrice,
        },
        pointsSpent: purchase.pointsSpent,
        purchasedAt: purchase.purchasedAt,
      })),
      claimedGems: user.claimedGems.map((gem) => ({
        id: gem.id,
        points: gem.points,
        contentTitle: gem.content.title,
        claimedAt: gem.claimedAt,
      })),
    };
  }
}
