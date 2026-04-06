import type { AuthState, User } from '../types';

const TOKEN_KEY = 'lumina_token';
const USER_KEY = 'lumina_user_cache';
const BOOKSHELF_KEY = 'lumina_active_bookshelf_id';

/** JWT — same key as `api.ts` Authorization header. */
export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Last known profile from a successful session; safe to show while re-validating the token. */
export function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as unknown;
    if (
      !u ||
      typeof u !== 'object' ||
      typeof (u as User).id !== 'number' ||
      typeof (u as User).email !== 'string'
    ) {
      return null;
    }
    return u as User;
  } catch {
    return null;
  }
}

export function writeSession(user: User, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function readActiveBookshelfId(): string | null {
  try {
    return localStorage.getItem(BOOKSHELF_KEY);
  } catch {
    return null;
  }
}

export function writeActiveBookshelfId(id: string | null) {
  try {
    if (id) localStorage.setItem(BOOKSHELF_KEY, id);
    else localStorage.removeItem(BOOKSHELF_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(BOOKSHELF_KEY);
}

export function getInitialAuthState(): AuthState {
  const token = readToken();
  if (!token) {
    return { user: null, token: null, isLoading: false };
  }
  const cached = readCachedUser();
  if (cached) {
    return { user: cached, token, isLoading: false };
  }
  return { user: null, token, isLoading: true };
}
