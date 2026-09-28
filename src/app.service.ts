import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return { name: 'Sparta workout API', status: 'ok' };
  }
}
