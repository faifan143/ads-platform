import { PartialType } from '@nestjs/mapped-types';
import { ContentDto } from '../content.dto/content.dto';

export class UpdateContentDto extends PartialType(ContentDto) {}
