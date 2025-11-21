export default class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Error.captureStackTrace?.(this, HttpError);
  }
}
