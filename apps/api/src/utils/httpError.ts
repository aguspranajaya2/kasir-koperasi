export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code = "HTTP_ERROR") {
    super(message);
    this.name = "HttpError";
  }
}
