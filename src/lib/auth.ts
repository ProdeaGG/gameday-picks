import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db, ensureDbInitialized } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'gameday-pickem-secret-key-super-secure-2026-cbs-espn'
);

const SESSION_COOKIE_NAME = 'gameday_session';
const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 days rolling persistent mobile login

export interface SessionPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(JWT_SECRET);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  await ensureDbInitialized();
  const session = await getSession();
  if (!session) return null;

  const foundUsers = await db
    .select({
      id: users.id,
      username: users.username,
      avatarType: users.avatar_type,
      avatarValue: users.avatar_value,
      isAdmin: users.is_admin,
      recoveryType: users.recovery_type,
      recoveryQuestion: users.recovery_question,
      createdAt: users.created_at,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return foundUsers[0] || null;
}

export async function clearSession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function comparePassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function hashRecoverySecret(secret: string): string {
  return bcrypt.hashSync(secret.trim().toLowerCase(), 10);
}

export function verifyRecoverySecret(secret: string, hash: string): boolean {
  return bcrypt.compareSync(secret.trim().toLowerCase(), hash);
}
