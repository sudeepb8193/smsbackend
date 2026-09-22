export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function createSuccessResponse<T>(
  data: T,
  message = 'Operation completed successfully',
  statusCode = 200,
): ApiResponse<T> {
  return {
    success: true,
    statusCode,
    message,
    data,
  };
}

export function createErrorResponse(
  message: string,
  statusCode = 400,
  code = 'BAD_REQUEST',
  details?: any,
): ApiResponse {
  return {
    success: false,
    statusCode,
    message,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}
