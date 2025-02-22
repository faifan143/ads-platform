import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentDto } from './dtos/content.dto/content.dto';
import { FindAllContentDto } from './dtos/find-all-content.dto/find-all-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto/update-content.dto';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  async create(contentDto: ContentDto) {
    const { interestIds, ...contentData } = contentDto;

    return this.prisma.content.create({
      data: {
        ...contentData,
        interests: {
          connect: interestIds.map((id) => ({ id })),
        },
      },
      include: {
        interests: true,
      },
    });
  }

  async findAll(params: FindAllContentDto = {}) {
    const { ownerId, type, interestId } = params;

    const where: any = {};

    if (ownerId) {
      where.owner = ownerId;
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

  async addLike(id: string) {
    // Check if content exists
    await this.findOne(id);

    return this.prisma.content.update({
      where: { id },
      data: {
        likes: {
          increment: 1,
        },
      },
      include: {
        interests: true,
      },
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

  async getWhatsAppLink(contentId: string) {
    // Get content with owner information
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { owner: true },
    });

    if (!content) {
      throw new NotFoundException(`Content with ID "${contentId}" not found`);
    }

    // Get the owner's phone number
    const owner = await this.prisma.user.findUnique({
      where: { id: content.owner },
      select: { phone: true },
    });

    if (!owner) {
      throw new NotFoundException('Content owner not found');
    }

    // Format phone for WhatsApp - convert from Syrian format (09XXXXXXXX) to international format
    // Replace "09" with "963" (Syria's country code)
    let formattedPhone = owner.phone;
    if (formattedPhone.startsWith('09')) {
      // Remove the "0" and add Syria's country code
      formattedPhone = `963${formattedPhone.substring(1)}`;
    }

    // Create WhatsApp link
    const whatsappLink = `https://wa.me/${formattedPhone}`;

    return { whatsappLink };
  }
}
