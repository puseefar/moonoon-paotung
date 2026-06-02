import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

const secret = new TextEncoder().encode(config.jwt.secret);

export interface TokenPayload extends JWTPayload {
  userId: string;
  deviceId: string;
  tier: string;
}

export async function signToken(payload: Omit<TokenPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify<TokenPayload>(token, secret);
  return payload;
}
