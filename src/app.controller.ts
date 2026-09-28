import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@ApiTags('Geral')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Identificar a API' })
  @ApiResponse({
    status: 200,
    description: 'Identificar a API: operação realizada com sucesso.',
  })
  @Get()
  getInfo() {
    return this.appService.getInfo();
  }
}
