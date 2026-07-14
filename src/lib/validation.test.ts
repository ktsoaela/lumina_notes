import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  coerceEntityTitle,
  parseApiErrorDetail,
  validateDisplayName,
  validateEmail,
  validateEntityId,
  validateEntityTitle,
  validateLoginIdentifier,
  validateLoginInput,
  validatePageContent,
  validatePassword,
  validateProfileInput,
  validateSignupInput,
  validateUsername,
} from './validation';

describe('notes auth validation', () => {
  it('validates email, password, and display name', () => {
    expect(validateEmail('').ok).toBe(false);
    expect(validateEmail('not-an-email').ok).toBe(false);
    expect(validateEmail('  User@Example.COM ').ok).toEqual(true);
    expect(validateEmail('  User@Example.COM ')).toMatchObject({
      value: 'user@example.com',
    });

    expect(validatePassword('123').ok).toBe(false);
    expect(validatePassword('secret1').ok).toBe(true);
    expect(validatePassword('x'.repeat(LIMITS.passwordMax + 1)).ok).toBe(false);

    expect(validateDisplayName('   ').ok).toBe(false);
    expect(validateDisplayName('  Ada Lovelace ').ok).toEqual(true);
  });

  it('validates username like FastAPI', () => {
    expect(validateUsername(undefined).ok).toBe(true);
    expect(validateUsername('').ok).toBe(true);
    expect(validateUsername('', { required: true }).ok).toBe(false);
    expect(validateUsername('Ab').ok).toBe(false);
    expect(validateUsername('Ada-Lovelace').ok).toBe(false);
    expect(validateUsername('Ada_Lovelace')).toMatchObject({
      ok: true,
      value: 'ada_lovelace',
    });
  });

  it('validates signup and login payloads end-to-end', () => {
    const bad = validateSignupInput({
      name: '',
      email: 'x',
      password: '1',
    });
    expect(bad.ok).toBe(false);

    const good = validateSignupInput({
      name: 'Khotso',
      email: 'k@example.com',
      password: 'secret1',
      username: 'Ktsoaela',
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.data.username).toBe('ktsoaela');
      expect(good.data.email).toBe('k@example.com');
    }

    expect(validateLoginIdentifier('').ok).toBe(false);
    const login = validateLoginInput({
      identifier: 'demo_user',
      password: 'demo_user',
    });
    expect(login.ok).toBe(true);
  });

  it('validates profile updates', () => {
    const bad = validateProfileInput({
      name: 'A',
      email: 'bad',
      username: '??',
    });
    expect(bad.ok).toBe(false);

    const good = validateProfileInput({
      name: 'A',
      email: 'a@b.co',
      username: '',
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.data.username).toBeNull();
  });
});

describe('notes entity validation', () => {
  it('normalizes notebook/section/page titles', () => {
    expect(validateEntityTitle('  My Note  ', 'page')).toMatchObject({
      ok: true,
      value: 'My Note',
    });
    expect(validateEntityTitle('   ', 'notebook')).toMatchObject({
      value: 'Untitled Notebook',
    });
    expect(validateEntityTitle('x'.repeat(LIMITS.entityTitleMax + 1), 'page').ok).toBe(
      false
    );
    expect(coerceEntityTitle('  Hello  ', 'section')).toBe('Hello');
    expect(coerceEntityTitle('   ', 'page')).toBe('Untitled');
  });

  it('validates page content size limits', () => {
    expect(validatePageContent('ok').ok).toBe(true);
    expect(validatePageContent('x'.repeat(LIMITS.pageContentMax + 1)).ok).toBe(false);
  });

  it('validates entity ids used by notes CRUD', () => {
    expect(validateEntityId('').ok).toBe(false);
    expect(validateEntityId('nb-123').ok).toBe(true);
    expect(validateEntityId('bad id').ok).toBe(false);
    expect(validateEntityId('page:1_ok').ok).toBe(true);
  });
});

describe('api error parsing', () => {
  it('reads FastAPI string and array detail shapes', () => {
    expect(parseApiErrorDetail({ detail: 'Nope' })).toBe('Nope');
    expect(
      parseApiErrorDetail({
        detail: [{ msg: 'field a' }, { msg: 'field b' }],
      })
    ).toBe('field a, field b');
    expect(parseApiErrorDetail(null, 'fallback')).toBe('fallback');
  });
});
