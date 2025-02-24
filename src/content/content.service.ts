import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentDto } from './dtos/content.dto/content.dto';
import { FindAllContentDto } from './dtos/find-all-content.dto/find-all-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto/update-content.dto';
import { FileManagementService } from 'src/file-management/file-management.service';

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
    return result.map((res) => res.path);
  }

  async create(
    files: Array<Express.Multer.File>,
    contentDto: Omit<ContentDto, 'mediaUrls'>,
  ) {
    const mediaUrls = await this.getMediaUrls(files);
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

  async findRelevantForUser(userId: string) {
    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gender: true,
        dateOfBirth: true,
        providence: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Calculate age from date of birth
    const today = new Date();
    const birthDate = new Date(user.dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();

    // Find content matching user's demographics
    return this.prisma.content.findMany({
      where: {
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
      },
      include: {
        interests: true,
        likedBy: true,
        viewedBy: true,
        whatsappedBy: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAsViewed(contentId: string, userId: string) {
    // Check if content exists
    await this.findOne(contentId);

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Create or update the view record
    await this.prisma.userContent.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
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
  }
  async addLike(contentId: string, userId: string) {
    // Check if content exists
    await this.findOne(contentId);

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Create or update the view record
    await this.prisma.userContentLike.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
      update: {
        likedAt: new Date(),
      },
      create: {
        userId,
        contentId,
        likedAt: new Date(),
      },
    });
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
