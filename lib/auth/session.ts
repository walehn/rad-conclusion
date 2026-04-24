import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';

/** Payload embedded in the signed+encrypted iron-session cookie. */
export interface SessionData {
  userId: number;
  email: string;
  issuedAt: number;
}

/** iron-session configuration (static fields only; password resolved at request time). */
export const sessionOptions: SessionOptions = {
  password: '',
  cookieName: 'rad_conclusion_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

/** Returns the live iron-session handle for the current request's cookies. */
export async function getSession(): Promise<IronSession<SessionData>> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET env var must be set and at least 32 characters long (use `openssl rand -hex 32`).'
    );
  }
  return getIronSession<SessionData>(await cookies(), { ...sessionOptions, password: secret });
}

/** Returns the current user payload, or null if the session is missing/invalid/unconfigured. */
export async function getCurrentUser(): Promise<SessionData | null> {
  // SESSION_SECRET may be absent during Next.js build-time static rendering; treat as no session.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return null;
  }
  const session = await getSession();
  if (!session.userId || !session.email) {
    return null;
  }
  return {
    userId: session.userId,
    email: session.email,
    issuedAt: session.issuedAt,
  };
}

/** Issues a new session cookie for the given user and persists it to the response. */
export async function issueSession(userId: number, email: string): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  session.issuedAt = Date.now();
  await session.save();
}

/** Destroys the current session cookie. */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
