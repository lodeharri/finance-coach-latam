import { describe, expect, it } from 'vitest';
import { joinUrl } from './url';

describe('joinUrl', () => {
  it('joins base + path with a single slash when neither has a separator', () => {
    expect(joinUrl('https://api.example.com', 'transactions')).toBe(
      'https://api.example.com/transactions',
    );
  });

  it('trims a single trailing slash from base before joining', () => {
    expect(joinUrl('https://api.example.com/', 'transactions')).toBe(
      'https://api.example.com/transactions',
    );
  });

  it('trims a single leading slash from path before joining', () => {
    expect(joinUrl('https://api.example.com', '/transactions')).toBe(
      'https://api.example.com/transactions',
    );
  });

  it('collapses a double slash when base ends with / and path starts with /', () => {
    // CORS double-slash bug — REQ-FFC-FE-CORS-FIX: the path must not produce
    // a "//transactions" segment in the outgoing URL.
    expect(joinUrl('https://api.example.com/', '/transactions')).toBe(
      'https://api.example.com/transactions',
    );
  });

  it('preserves multi-segment paths (e.g. nested resource)', () => {
    expect(joinUrl('https://api.example.com', 'transactions/abc/categorize')).toBe(
      'https://api.example.com/transactions/abc/categorize',
    );
    expect(joinUrl('https://api.example.com/', '/transactions/abc/categorize')).toBe(
      'https://api.example.com/transactions/abc/categorize',
    );
  });

  it('preserves query strings on the path verbatim', () => {
    expect(
      joinUrl('https://api.example.com', 'transactions?limit=10&userId=u1'),
    ).toBe('https://api.example.com/transactions?limit=10&userId=u1');
    expect(
      joinUrl('https://api.example.com/', '/transactions?limit=10&userId=u1'),
    ).toBe('https://api.example.com/transactions?limit=10&userId=u1');
  });

  it('returns the base unchanged when path is the empty string', () => {
    expect(joinUrl('https://api.example.com', '')).toBe(
      'https://api.example.com',
    );
    expect(joinUrl('https://api.example.com/', '')).toBe(
      'https://api.example.com/',
    );
  });

  it('returns the base unchanged when path is undefined', () => {
    expect(joinUrl('https://api.example.com', undefined)).toBe(
      'https://api.example.com',
    );
  });

  it('does not trim trailing slashes from multi-segment paths', () => {
    // /transactions/{id}/  would only happen if the caller passes the
    // trailing slash deliberately. joinUrl does not touch the path's
    // interior — only the leading boundary.
    expect(joinUrl('https://api.example.com', 'transactions/abc/')).toBe(
      'https://api.example.com/transactions/abc/',
    );
  });

  it('does not trim trailing slashes from base beyond a single one', () => {
    expect(joinUrl('https://api.example.com//', 'transactions')).toBe(
      'https://api.example.com//transactions',
    );
  });

  it('throws TypeError when base is not a string', () => {
    expect(() => joinUrl(undefined as unknown as string, 'transactions')).toThrow(
      TypeError,
    );
    expect(() => joinUrl(null as unknown as string, 'transactions')).toThrow(
      TypeError,
    );
    expect(() => joinUrl(42 as unknown as string, 'transactions')).toThrow(
      TypeError,
    );
    expect(() => joinUrl({} as unknown as string, 'transactions')).toThrow(
      TypeError,
    );
  });

  it('throws TypeError when path is not a string (and not undefined)', () => {
    expect(() => joinUrl('https://api.example.com', 42 as unknown as string)).toThrow(
      TypeError,
    );
    expect(() => joinUrl('https://api.example.com', null as unknown as string)).toThrow(
      TypeError,
    );
    expect(() => joinUrl('https://api.example.com', {} as unknown as string)).toThrow(
      TypeError,
    );
  });

  it('accepts empty base (returns "/path" — caller is responsible for valid base)', () => {
    expect(joinUrl('', 'transactions')).toBe('/transactions');
    expect(joinUrl('', '/transactions')).toBe('/transactions');
  });
});