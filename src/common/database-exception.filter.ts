import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Prisma RC may wrap the PostgreSQL error in several cause objects.
export function postgresErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const entry = current as {
      code?: unknown;
      sqlState?: unknown;
      cause?: unknown;
    };
    if (typeof entry.sqlState === 'string') return entry.sqlState;
    if (typeof entry.code === 'string' && /^\d{5}$/.test(entry.code))
      return entry.code;
    current = entry.cause;
  }
}

@Catch()
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    const code = postgresErrorCode(error);
    if (
      code === '23505' ||
      code === '23503' ||
      code === '40001' ||
      code === '40P01'
    ) {
      response.status(409).json({
        statusCode: 409,
        message: 'Operation conflicts with existing data. Reload and retry.',
      });
      return;
    }
    // Do not log database error messages: they can contain submitted data or credentials.
    this.logger.error(`Unhandled request error (${code ?? 'unknown'})`);
    response
      .status(500)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
