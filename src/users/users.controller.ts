import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/user.dto.js';
import { PageQueryDto } from '../common/dto/list-query.dto.js';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @ApiOperation({ summary: 'Criar usuário' })
  @ApiResponse({
    status: 201,
    description: 'Criar usuário: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
  @ApiOperation({ summary: 'Listar usuários' })
  @ApiResponse({
    status: 200,
    description: 'Listar usuários: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @Get()
  list(@Query() query: PageQueryDto) {
    return this.users.list(query);
  }
  @ApiOperation({ summary: 'Consultar usuário' })
  @ApiResponse({
    status: 200,
    description: 'Consultar usuário: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }
  @ApiOperation({ summary: 'Alterar nome do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Alterar nome do usuário: operação realizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Entrada inválida, UUID inválido ou campo desconhecido.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Recurso não encontrado ou vínculo fora do recurso pai informado.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID do recurso retornado pela API.',
  })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateUserDto) {
    return this.users.update(id, dto);
  }
}
