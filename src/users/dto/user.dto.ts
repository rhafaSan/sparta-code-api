import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    type: 'string',
    maxLength: 200,
    pattern: '\\S',
    example: 'Rafael',
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
}
