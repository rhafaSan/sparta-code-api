import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty({ format: 'email', example: 'user@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'negresco', minLength: 3, maxLength: 30 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/)
  username!: string;

  @ApiProperty({
    writeOnly: true,
    format: 'password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\S/)
  password!: string;
}

export class UpdateUserDto {
  @ApiProperty({ type: 'string', maxLength: 200, example: 'Rafael' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
}
