/**
 * Frontend validation aligned with FastAPI (`app.py`) for production-ready notes UX.
 * Prefer these helpers before API calls so users get clear client-side errors.
 */

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type OptionalValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export const LIMITS = {
  nameMin: 1,
  nameMax: 80,
  emailMax: 254,
  passwordMin: 6,
  passwordMax: 128,
  usernameMin: 3,
  usernameMax: 32,
  entityTitleMax: 120,
  pageContentMax: 2_000_000,
  entityIdMax: 64,
} as const;

export function normalizeWhitespace(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function validateEmail(raw: string): ValidationResult {
  const email = normalizeWhitespace(raw).toLowerCase();
  if (!email) return { ok: false, error: 'Email is required' };
  if (email.length > LIMITS.emailMax) {
    return { ok: false, error: `Email must be at most ${LIMITS.emailMax} characters` };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address' };
  return { ok: true, value: email };
}

export function validatePassword(raw: string): ValidationResult {
  if (!raw) return { ok: false, error: 'Password is required' };
  if (raw.length < LIMITS.passwordMin) {
    return {
      ok: false,
      error: `Password must be at least ${LIMITS.passwordMin} characters`,
    };
  }
  if (raw.length > LIMITS.passwordMax) {
    return {
      ok: false,
      error: `Password must be at most ${LIMITS.passwordMax} characters`,
    };
  }
  return { ok: true, value: raw };
}

export function validateDisplayName(raw: string): ValidationResult {
  const name = normalizeWhitespace(raw);
  if (!name) return { ok: false, error: 'Name is required' };
  if (name.length > LIMITS.nameMax) {
    return { ok: false, error: `Name must be at most ${LIMITS.nameMax} characters` };
  }
  return { ok: true, value: name };
}

/** Matches FastAPI `_normalize_username` (lowercase letters, numbers, underscore). */
export function validateUsername(
  raw: string | null | undefined,
  opts: { required?: boolean } = {}
): OptionalValidationResult {
  const required = opts.required === true;
  if (raw == null || !String(raw).trim()) {
    if (required) return { ok: false, error: 'Username is required' };
    return { ok: true, value: null };
  }
  const username = String(raw).trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        'Username must be 3–32 characters: lowercase letters, numbers, underscore',
    };
  }
  return { ok: true, value: username };
}

export function validateLoginIdentifier(raw: string): ValidationResult {
  const key = normalizeWhitespace(raw);
  if (!key) return { ok: false, error: 'Email or username is required' };
  if (key.length > LIMITS.emailMax) {
    return { ok: false, error: 'Login identifier is too long' };
  }
  return { ok: true, value: key };
}

export function validateEntityTitle(
  raw: string,
  kind: 'notebook' | 'section' | 'page' | 'bookshelf' | 'chart' = 'page',
  opts: { allowEmptyFallback?: string } = {}
): ValidationResult {
  const fallback =
    opts.allowEmptyFallback ??
    (kind === 'notebook'
      ? 'Untitled Notebook'
      : kind === 'section'
        ? 'Untitled Section'
        : kind === 'bookshelf'
          ? 'Untitled bookshelf'
          : kind === 'chart'
            ? 'Untitled chart'
            : 'Untitled');
  let title = normalizeWhitespace(raw);
  if (!title) title = fallback;
  if (title.length > LIMITS.entityTitleMax) {
    return {
      ok: false,
      error: `Title must be at most ${LIMITS.entityTitleMax} characters`,
    };
  }
  return { ok: true, value: title };
}

/** Soft trim for autosave titles — never fails, always returns a usable string. */
export function coerceEntityTitle(
  raw: string,
  kind: 'notebook' | 'section' | 'page' | 'bookshelf' | 'chart' = 'page'
): string {
  const r = validateEntityTitle(raw, kind);
  return r.ok ? r.value : normalizeWhitespace(raw).slice(0, LIMITS.entityTitleMax) || 'Untitled';
}

export function validatePageContent(raw: string): ValidationResult {
  const content = raw ?? '';
  if (content.length > LIMITS.pageContentMax) {
    return {
      ok: false,
      error: `Page content exceeds the ${LIMITS.pageContentMax.toLocaleString()} character limit`,
    };
  }
  return { ok: true, value: content };
}

export function validateEntityId(raw: string): ValidationResult {
  const id = String(raw ?? '').trim();
  if (!id) return { ok: false, error: 'Id is required' };
  if (id.length > LIMITS.entityIdMax) {
    return { ok: false, error: `Id must be at most ${LIMITS.entityIdMax} characters` };
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
    return { ok: false, error: 'Id contains invalid characters' };
  }
  return { ok: true, value: id };
}

export function validateSignupInput(input: {
  name: string;
  email: string;
  password: string;
  username?: string;
}): { ok: true; data: { name: string; email: string; password: string; username: string | null } } | { ok: false; error: string } {
  const name = validateDisplayName(input.name);
  if (name.ok === false) return { ok: false, error: name.error };
  const email = validateEmail(input.email);
  if (email.ok === false) return { ok: false, error: email.error };
  const password = validatePassword(input.password);
  if (password.ok === false) return { ok: false, error: password.error };
  const username = validateUsername(input.username);
  if (username.ok === false) return { ok: false, error: username.error };
  return {
    ok: true,
    data: {
      name: name.value,
      email: email.value,
      password: password.value,
      username: username.value,
    },
  };
}

export function validateLoginInput(input: {
  identifier: string;
  password: string;
}): { ok: true; data: { identifier: string; password: string } } | { ok: false; error: string } {
  const identifier = validateLoginIdentifier(input.identifier);
  if (identifier.ok === false) return { ok: false, error: identifier.error };
  const password = validatePassword(input.password);
  if (password.ok === false) return { ok: false, error: password.error };
  return {
    ok: true,
    data: { identifier: identifier.value, password: password.value },
  };
}

export function validateProfileInput(input: {
  name: string;
  email: string;
  username?: string;
}): { ok: true; data: { name: string; email: string; username: string | null } } | { ok: false; error: string } {
  const name = validateDisplayName(input.name);
  if (name.ok === false) return { ok: false, error: name.error };
  const email = validateEmail(input.email);
  if (email.ok === false) return { ok: false, error: email.error };
  const username = validateUsername(input.username);
  if (username.ok === false) return { ok: false, error: username.error };
  return {
    ok: true,
    data: {
      name: name.value,
      email: email.value,
      username: username.value,
    },
  };
}

/** Extract FastAPI `detail` from JSON error bodies. */
export function parseApiErrorDetail(
  body: unknown,
  fallback = 'Request failed'
): string {
  if (!body || typeof body !== 'object') return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const msg = (item as { msg?: unknown }).msg;
        return typeof msg === 'string' ? msg : null;
      })
      .filter(Boolean) as string[];
    if (msgs.length) return msgs.join(', ');
  }
  return fallback;
}

export async function readApiError(
  res: Response,
  fallback: string
): Promise<string> {
  try {
    const body = await res.json();
    return parseApiErrorDetail(body, fallback);
  } catch {
    return fallback;
  }
}
