export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  sessionId: string;
  role?: 'user' | 'admin' | 'superadmin';
  iat: number;
  exp: number;
}
