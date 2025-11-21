export default class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        Error.captureStackTrace?.(this, HttpError);
    }
}
