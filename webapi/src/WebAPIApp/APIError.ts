export class APIError extends Error {
  constructor(readonly code: number = 500, message?: string) {
    super(message);
  }
}

export class NotFoundError extends APIError {
  constructor(message?: string) {
    super(404, message);
  }
}
