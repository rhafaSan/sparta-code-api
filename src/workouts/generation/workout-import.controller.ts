import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TextDecoder } from 'node:util';
import { CurrentUserId } from '../../auth/auth.decorators.js';
import { ImportWorkoutDto } from '../dto/import-workout.dto.js';
import { WorkoutGenerationService } from './workout-generation.service.js';

export interface WorkoutUpload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export function workoutImportSource(
  dto: ImportWorkoutDto,
  file?: WorkoutUpload,
): string | Buffer {
  if ((dto.text !== undefined) === !!file)
    throw new BadRequestException('Send exactly one source: text or file');
  if (!file) {
    if (
      typeof dto.text !== 'string' ||
      !dto.text.trim() ||
      dto.text.length > 30000
    )
      throw new BadRequestException('Text must contain 1 to 30000 characters');
    return dto.text.trim();
  }
  if (!file.buffer.length || file.buffer.length > 5 * 1024 * 1024)
    throw new BadRequestException('File must contain 1 byte to 5 MB');
  if (
    /\.pdf$/i.test(file.originalname) &&
    file.mimetype === 'application/pdf'
  ) {
    if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw new BadRequestException('Invalid PDF signature');
    return file.buffer;
  }
  if (
    !/\.txt$/i.test(file.originalname) ||
    !['text/plain', 'application/octet-stream'].includes(file.mimetype)
  )
    throw new BadRequestException('Only PDF and UTF-8 TXT files are supported');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw new BadRequestException('TXT must use UTF-8 encoding');
  }
  if (text.includes('\0')) throw new BadRequestException('Invalid TXT content');
  return workoutImportSource({ text });
}

@ApiTags('Treinos')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutImportController {
  constructor(private readonly generation: WorkoutGenerationService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Importar ficha PDF, TXT ou texto e salvar seus treinos',
    description:
      'Envia o conteúdo ao Gemini. Aceita até 12 treinos com 20 exercícios cada, vinculados ao catálogo ativo. Todos são salvos em uma transação. Requer GEMINI_API_KEY.',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', maxLength: 30000 },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 1,
        fieldSize: 120000,
        parts: 2,
      },
    }),
  )
  importSheet(
    @CurrentUserId() userId: string,
    @Body() dto: ImportWorkoutDto,
    @UploadedFile() file?: WorkoutUpload,
  ) {
    return this.generation.importSheet(userId, workoutImportSource(dto, file));
  }
}
