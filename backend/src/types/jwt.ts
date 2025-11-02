export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  sessionId: string;
  iat: number;
  exp: number;
}
