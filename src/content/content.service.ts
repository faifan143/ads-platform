import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentDto } from './dtos/content.dto/content.dto';
import { FindAllContentDto } from './dtos/find-all-content.dto/find-all-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto/update-content.dto';
import { FileManagementService } from 'src/file-management/file-management.service';
import { Logger } from '@nestjs/common';
@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private fileManagementService: FileManagementService,
  ) {}

  private async getMediaUrls(files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    console.log('pre files : ', files);

    const result = await this.fileManagementService.saveFiles(files);

    // Transform processed files into structured mediaUrls
    return result.map((file) => {
      if (file.mediaType === 'IMAGE') {
        return {
          type: 'IMAGE',
          url: file.path,
        };
      } else {
        return {
          type: 'VIDEO',
          url: file.path,
          poster: file.posterPath || null,
        };
      }
    });
  }

  async create(
    files: Array<Express.Multer.File>,
    contentDto: Omit<ContentDto, 'mediaUrls'>,
  ) {
    const processedFiles = await this.fileManagementService.saveFiles(files);

    // Transform processed files into structured mediaUrls
    const mediaUrls = processedFiles.map((file) => {
      if (file.mediaType === 'IMAGE') {
        return {
          type: 'IMAGE',
          url: file.path,
        };
      } else {
        return {
          type: 'VIDEO',
          url: file.path,
          poster: file.posterPath || null,
        };
      }
    });

    const { interestIds, ...contentData } = contentDto;

    let interests = [];
    if (!contentDto.interestIds || contentDto.interestIds.length == 0) {
      interests = await this.prisma.interest.findMany({
        select: {
          id: true,
        },
      });
      interests = interests.map((item) => item.id);
      console.log('all interest : ', interests);
    } else {
      interests = interestIds;
      console.log('only interest : ', interests);
    }

    return this.prisma.content.create({
      data: {
        ...contentData,
        intervalHours: parseInt(contentData.intervalHours + ''),
        mediaUrls,
        interests: {
          connect: interests.map((id) => ({ id })),
        },
      },
      include: {
        interests: true,
      },
    });
  }

  async findAll(params: FindAllContentDto = {}) {
    const { ownerName, ownerNumber, type, interestId } = params;

    const where: any = {};

    if (ownerName) {
      where.ownerName = ownerName;
    }
    if (ownerNumber) {
      where.ownerNumber = ownerNumber;
    }

    if (type) {
      where.type = type;
    }

    if (interestId) {
      where.interests = {
        some: {
          id: interestId,
        },
      };
    }

    return this.prisma.content.findMany({
      where,
      include: {
        interests: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        interests: true,
      },
    });

    if (!content) {
      throw new NotFoundException(`Content with ID "${id}" not found`);
    }

    return content;
  }

  async update(id: string, updateContentDto: UpdateContentDto) {
    const { interestIds, ...contentData } = updateContentDto;

    // Check if content exists
    await this.findOne(id);

    // If interestIds is provided, update the relationship
    let interestsData = undefined;
    if (interestIds) {
      interestsData = {
        set: [], // Clear existing connections
        connect: interestIds.map((id) => ({ id })), // Create new connections
      };
    }

    return this.prisma.content.update({
      where: { id },
      data: {
        ...contentData,
        interests: interestsData,
      },
      include: {
        interests: true,
      },
    });
  }

  async remove(id: string) {
    // Check if content exists
    await this.findOne(id);

    // First, remove any user-content relationships
    await this.prisma.userContent.deleteMany({
      where: { contentId: id },
    });

    // Then delete the content
    await this.prisma.content.delete({
      where: { id },
    });
  }
  async findRelevantForUser(userId: string, page = 1, pageSize = 10) {
    console.log(userId);

    try {
      // Validate pagination parameters
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 10;

      // Calculate pagination values
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Get user details
      let user;
      try {
        user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            gender: true,
            dateOfBirth: true,
            providence: true,
          },
        });
      } catch (error) {
        Logger.error(
          `Database error while fetching user: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to fetch user information',
        );
      }

      if (!user) {
        throw new NotFoundException(`User with ID "${userId}" not found`);
      }

      // Calculate age from date of birth
      const today = new Date();
      const birthDate = new Date(user.dateOfBirth);
      const age = today.getFullYear() - birthDate.getFullYear();

      // Define the where clause for relevant content
      const whereClause = {
        // Content that's still valid
        endValidationDate: {
          gte: new Date(),
        },
        // Content matching user's interests by age and gender
        interests: {
          some: {
            OR: [
              { targetedGender: null }, // For all genders
              { targetedGender: user.gender }, // For specific gender
            ],
            AND: [
              { minAge: { lte: age } }, // User age greater than min age
              { maxAge: { gte: age } }, // User age less than max age
            ],
          },
        },
      };

      // Get total count and viewed/liked content IDs with error handling
      let totalCount, viewedContent, likedContent;

      try {
        // Execute queries in parallel for better performance
        [totalCount, viewedContent, likedContent] = await Promise.all([
          this.prisma.content.count({
            where: whereClause,
          }),
          this.prisma.userContent.findMany({
            where: { userId },
            select: { contentId: true },
          }),
          this.prisma.userContentLike.findMany({
            where: { userId },
            select: { contentId: true },
          }),
        ]);
      } catch (error) {
        Logger.error(
          `Database error while fetching content metadata: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to fetch content information',
        );
      }

      // Extract the content IDs into arrays
      const viewedContentIds = viewedContent.map((item) => item.contentId);
      const likedContentIds = likedContent.map((item) => item.contentId);

      // Fetch unwatched and watched content with error handling
      let unwatchedContent, watchedContent;

      try {
        // Fetch unwatched content
        unwatchedContent = await this.prisma.content.findMany({
          where: {
            ...whereClause,
            NOT: { id: { in: viewedContentIds } },
          },
          include: {
            interests: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                likedBy: true,
                viewedBy: true,
                whatsappedBy: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        Logger.error(
          `Database error while fetching unwatched content: ${error.message}`,
          error.stack,
        );
        unwatchedContent = [];
      }

      try {
        // Fetch watched content
        watchedContent = await this.prisma.content.findMany({
          where: {
            ...whereClause,
            id: { in: viewedContentIds },
          },
          include: {
            interests: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                likedBy: true,
                viewedBy: true,
                whatsappedBy: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        Logger.error(
          `Database error while fetching watched content: ${error.message}`,
          error.stack,
        );
        watchedContent = [];
      }

      // Add isLiked and isWatched properties
      const unwatchedWithFlags = unwatchedContent.map((content) => ({
        ...content,
        isLiked: likedContentIds.includes(content.id),
        isWatched: false,
      }));

      const watchedWithFlags = watchedContent.map((content) => ({
        ...content,
        isLiked: likedContentIds.includes(content.id),
        isWatched: true,
      }));

      // Merge and paginate content
      const mergedContent = [...unwatchedWithFlags, ...watchedWithFlags];
      const relevantContent = mergedContent.slice(skip, skip + take);

      // Handle fallback when no relevant content found
      if (relevantContent.length === 0) {
        try {
          return await this.getFallbackContent(
            userId,
            likedContentIds,
            page,
            pageSize,
          );
        } catch (fallbackError) {
          Logger.error(
            `Error getting fallback content: ${fallbackError.message}`,
            fallbackError.stack,
          );
          // Even if fallback fails, return empty data with pagination info
          return {
            data: [],
            meta: {
              currentPage: page,
              itemsPerPage: pageSize,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: page > 1,
            },
            isRelevant: false,
          };
        }
      }

      // Return the paginated content with pagination metadata
      return {
        data: relevantContent,
        meta: {
          currentPage: page,
          itemsPerPage: pageSize,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasNextPage: page < Math.ceil(totalCount / pageSize),
          hasPreviousPage: page > 1,
        },
        isRelevant: true,
      };
    } catch (error) {
      // Global error handler for the entire method
      Logger.error(
        `Error in findRelevantForUser: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error; // Rethrow NotFoundExceptions as they're already properly formatted
      }

      if (error instanceof InternalServerErrorException) {
        throw error; // Rethrow InternalServerErrorExceptions as they're already properly formatted
      }

      // Handle any other unexpected errors
      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching relevant content',
      );
    }
  }

  // Extract fallback content logic to a separate method for better organization
  private async getFallbackContent(
    userId: string,
    likedContentIds: string[],
    page: number,
    pageSize: number,
  ) {
    // Calculate pagination values
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const fallbackWhereClause = {
      endValidationDate: {
        gte: new Date(),
      },
    };

    try {
      // Get total count for fallback content
      const fallbackTotalCount = await this.prisma.content.count({
        where: fallbackWhereClause,
      });

      // Get viewed content IDs
      const viewedFallbackContent = await this.prisma.userContent.findMany({
        where: { userId },
        select: { contentId: true },
      });

      // Extract the content IDs into an array
      const viewedFallbackContentIds = viewedFallbackContent.map(
        (item) => item.contentId,
      );

      // Get unwatched fallback content
      const unwatchedFallbackContent = await this.prisma.content.findMany({
        where: {
          ...fallbackWhereClause,
          NOT: { id: { in: viewedFallbackContentIds } },
        },
        include: {
          interests: true,
          _count: {
            select: {
              likedBy: true,
              viewedBy: true,
              whatsappedBy: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get watched fallback content
      const watchedFallbackContent = await this.prisma.content.findMany({
        where: {
          ...fallbackWhereClause,
          id: { in: viewedFallbackContentIds },
        },
        include: {
          interests: true,
          _count: {
            select: {
              likedBy: true,
              viewedBy: true,
              whatsappedBy: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Add isLiked and isWatched properties
      const unwatchedFallbackWithFlags = unwatchedFallbackContent.map(
        (content) => ({
          ...content,
          isLiked: likedContentIds.includes(content.id),
          isWatched: false,
        }),
      );

      const watchedFallbackWithFlags = watchedFallbackContent.map(
        (content) => ({
          ...content,
          isLiked: likedContentIds.includes(content.id),
          isWatched: true,
        }),
      );

      // Merge and paginate content
      const mergedFallbackContent = [
        ...unwatchedFallbackWithFlags,
        ...watchedFallbackWithFlags,
      ];
      const fallbackContent = mergedFallbackContent.slice(skip, skip + take);

      return {
        data: fallbackContent,
        meta: {
          currentPage: page,
          itemsPerPage: pageSize,
          totalItems: fallbackTotalCount,
          totalPages: Math.ceil(fallbackTotalCount / pageSize),
          hasNextPage: page < Math.ceil(fallbackTotalCount / pageSize),
          hasPreviousPage: page > 1,
        },
        isRelevant: false,
      };
    } catch (error) {
      Logger.error(
        `Error in fallback content retrieval: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to be handled by the main method
    }
  }

  /**
   * Creates a "gem" (reward) for a random piece of content that will be awarded to the first user who views it
   * @param points - The number of points the gem is worth
   */
  async generateGem(points: number) {
    if (points <= 0) {
      throw new BadRequestException('Points value must be greater than zero');
    }

    // Find all valid content
    const validContent = await this.prisma.content.findMany({
      where: {
        endValidationDate: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (validContent.length === 0) {
      throw new BadRequestException(
        'No valid content available for gem generation',
      );
    }

    // Randomly select a piece of content
    const randomIndex = Math.floor(Math.random() * validContent.length);
    const selectedContent = validContent[randomIndex];

    // Check if there's already a gem for this content
    const existingGem = await this.prisma.contentGem.findUnique({
      where: {
        contentId: selectedContent.id,
      },
    });

    if (existingGem) {
      // Update existing gem
      const updatedGem = await this.prisma.contentGem.update({
        where: {
          contentId: selectedContent.id,
        },
        data: {
          points: points,
          createdAt: new Date(),
          claimedByUserId: null,
          claimedAt: null,
        },
      });

      return {
        success: true,
        message: 'Gem updated successfully',
        gem: {
          contentId: updatedGem.contentId,
          contentTitle: selectedContent.title,
          points: updatedGem.points,
        },
      };
    } else {
      // Create new gem
      const newGem = await this.prisma.contentGem.create({
        data: {
          contentId: selectedContent.id,
          points: points,
        },
      });

      return {
        success: true,
        message: 'Gem created successfully',
        gem: {
          contentId: newGem.contentId,
          contentTitle: selectedContent.title,
          points: newGem.points,
        },
      };
    }
  }

  /**
   * Modified markAsViewed to check for and claim gems
   */
  async markAsViewed(contentId: string, userId: string) {
    // Check if both content and user exist at the same time to reduce database calls
    const [content, user] = await Promise.all([
      this.prisma.content.findUnique({ where: { id: contentId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!content) {
      throw new NotFoundException(`Content with ID "${contentId}" not found`);
    }

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Check if user has already viewed this content
    const existingView = await this.prisma.userContent.findUnique({
      where: {
        userId_contentId: { userId, contentId },
      },
    });

    // Only award points if it's a new view
    const shouldAwardPoints = !existingView;

    // Create or update the view record
    await this.prisma.userContent.upsert({
      where: {
        userId_contentId: { userId, contentId },
      },
      update: {
        viewedAt: new Date(),
      },
      create: {
        userId,
        contentId,
        viewedAt: new Date(),
      },
    });

    let pointsAwarded = 0;
    let gemClaimed = false;
    let gemPoints = 0;

    // Award points to user if this is a new view
    if (shouldAwardPoints) {
      // Check if there's an unclaimed gem for this content
      const gem = await this.prisma.contentGem.findFirst({
        where: {
          contentId,
          claimedByUserId: null,
        },
      });

      // Base points for viewing content
      pointsAwarded = 2;

      // If there's a gem, claim it and award additional points
      if (gem) {
        gemClaimed = true;
        gemPoints = gem.points;
        pointsAwarded += gem.points;

        // Update gem to mark it as claimed
        await this.prisma.contentGem.update({
          where: { id: gem.id },
          data: {
            claimedByUserId: userId,
            claimedAt: new Date(),
          },
        });
      }

      // Update user's points
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          points: {
            increment: pointsAwarded,
          },
        },
      });

      const responseMessage = gemClaimed
        ? `Content marked as viewed and ${pointsAwarded} points awarded (including ${gemPoints} gem bonus!)`
        : 'Content marked as viewed and 2 points awarded';

      return {
        success: true,
        message: responseMessage,
        pointsAwarded,
        gemClaimed,
        gemPoints: gemClaimed ? gemPoints : undefined,
      };
    }

    return {
      success: true,
      message: 'Content marked as viewed',
      pointsAwarded: 0,
    };
  }
  /**
   * Toggles a like on content - if already liked, removes the like;
   * if not liked, adds a like and awards points
   */
  async addLike(contentId: string, userId: string) {
    // Check if both content and user exist at the same time
    const [content, user] = await Promise.all([
      this.prisma.content.findUnique({ where: { id: contentId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!content) {
      throw new NotFoundException(`Content with ID "${contentId}" not found`);
    }

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Check if user has already liked this content
    const existingLike = await this.prisma.userContentLike.findUnique({
      where: {
        userId_contentId: { userId, contentId },
      },
    });

    // If the content is already liked, remove the like
    if (existingLike) {
      await this.prisma.userContentLike.delete({
        where: {
          userId_contentId: { userId, contentId },
        },
      });

      // Subtract points when unliking (optional - depends on your business logic)
      // If you don't want to subtract points when unliking, remove this block
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          points: {
            decrement: 1, // Subtract 1 points for unliking
          },
        },
      });

      return {
        success: true,
        action: 'unliked',
        message: 'Like removed from content',
        pointsChange: -1,
      };
    }

    // If not liked yet, add a like
    await this.prisma.userContentLike.create({
      data: {
        userId,
        contentId,
        likedAt: new Date(),
      },
    });

    // Award points to user for liking content
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: 1, // Add 1 points for liking
        },
      },
    });

    return {
      success: true,
      action: 'liked',
      message: 'Content liked successfully',
      pointsChange: 1,
    };
  }

  async getWhatsAppLink(contentId: string, userId: string) {
    // Get content with owner information
    const content = await this.findOne(contentId);

    // Format phone for WhatsApp - convert from Syrian format (09XXXXXXXX) to international format
    // Replace "09" with "963" (Syria's country code)
    let formattedPhone = content.ownerNumber;
    if (formattedPhone.startsWith('09')) {
      // Remove the "0" and add Syria's country code
      formattedPhone = `963${formattedPhone.substring(1)}`;
    }

    // Create or update the view record
    await this.prisma.userContentWhatsApp.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
      update: {
        whatsappedAt: new Date(),
      },
      create: {
        userId,
        contentId,
        whatsappedAt: new Date(),
      },
    });

    // Create WhatsApp link
    const whatsappLink = `https://wa.me/${formattedPhone}`;

    return { whatsappLink };
  }
}
