import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;
}

export class ActiveQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ type: 'boolean', default: false })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeArchived = false;
}

export class WorkoutQueryDto extends ActiveQueryDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;
}

export class HistoryQueryDto extends PageQueryDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-42d3-a456-426614174000',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  workoutId?: string;
}
