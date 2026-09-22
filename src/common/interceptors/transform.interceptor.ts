import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, createSuccessResponse } from '../utils/response.util';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If data is already in ApiResponse format, return as is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'statusCode' in data
        ) {
          return data;
        }

        const statusCode = response.statusCode || 200;
        let message = 'Operation completed successfully';

        if (
          data &&
          typeof data === 'object' &&
          data.message &&
          typeof data.message === 'string'
        ) {
          message = data.message;
          delete data.message;
        }

        return createSuccessResponse(data, message, statusCode);
      }),
    );
  }
}
