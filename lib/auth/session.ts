import { cookies } from 'next/headers';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';

/** Payload embedded in the signed+encrypted iron-session cookie. */
export interface SessionData {
  userId: number;
  email: string;
  issuedAt: number;
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    'SESSION_SECRET env var must be set and at least 32 characters long (use `openssl rand -hex 32`).'
  );
}

/** iron-session configuration for the rad_conclusion auth cookie. */
export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
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
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Returns the current user payload, or null if the session is missing/invalid. */
export async function getCurrentUser(): Promise<SessionData | null> {
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
