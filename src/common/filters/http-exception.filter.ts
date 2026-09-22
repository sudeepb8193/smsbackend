import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { createErrorResponse } from '../utils/response.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected server error occurred';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as any;
        message = resObj.message || exception.message;
        errorCode =
          resObj.code || resObj.error || this.getErrorCodeFromStatus(status);

        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          errorCode = 'VALIDATION_ERROR';
          details = resObj.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload = createErrorResponse(message, status, errorCode, details);
    response.status(status).json(payload);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'INVALID_CREDENTIALS';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'EMAIL_ALREADY_REGISTERED';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
