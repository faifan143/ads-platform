// src/interest/interest.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateInterestDto, UpdateInterestDto } from './dtos/interest.dto';
import { InterestService } from './interest.service';

@Controller('interests')
// @UseGuards(JwtAuthGuard)
export class InterestController {
  constructor(private interestService: InterestService) {}

  @Post()
  create(@Body() dto: CreateInterestDto) {
    return this.interestService.create(dto);
  }

  @Get()
  findAll() {
    return this.interestService.findAll();
  }

  @Get('id/:id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.interestService.findById(id);
  }

  @Get('name/:name')
  findByName(@Param('name') name: string) {
    return this.interestService.findByName(name);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterestDto,
  ) {
    return this.interestService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.interestService.delete(id);
  }
}
