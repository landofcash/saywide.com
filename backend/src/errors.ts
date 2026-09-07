export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(code: string, message = "The requested resource was not found."): AppError {
  return new AppError(404, code, message);
}
