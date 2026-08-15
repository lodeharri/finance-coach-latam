import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_ORIGINS,
  parseAllowedOrigins,
  resolveDemoPasswordParamName,
} from './env.config';

describe('parseAllowedOrigins', () => {
  it('returns the documented defaults when the env var is missing', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(DEFAULT_ALLOWED_ORIGINS).toEqual([
      'https://finance-coach-latam.pages.dev',
      'http://localhost:5173',
    ]);
  });

  it('returns the defaults when the env var is an empty string', () => {
    expect(parseAllowedOrigins('')).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(parseAllowedOrigins('   ')).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });

  it('parses a single origin', () => {
    expect(parseAllowedOrigins('https://example.com')).toEqual([
      'https://example.com',
    ]);
  });

  it('parses, trims, and de-duplicates a CSV', () => {
    expect(
      parseAllowedOrigins(
        ' https://a.example ,https://b.example,https://a.example ',
      ),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('rejects an entry without an http(s) scheme', () => {
    expect(() => parseAllowedOrigins('example.com')).toThrow(
      /not an absolute URL/,
    );
    expect(() => parseAllowedOrigins('ftp://example.com')).toThrow(
      /not an absolute URL/,
    );
  });

  it('rejects an empty entry (e.g. trailing comma)', () => {
    expect(() => parseAllowedOrigins('https://a.example,')).toThrow(
      /empty entry/,
    );
    expect(() => parseAllowedOrigins(',https://a.example')).toThrow(
      /empty entry/,
    );
    expect(() => parseAllowedOrigins('https://a.example,,https://b.example')).toThrow(
      /empty entry/,
    );
  });

  it('preserves case-sensitive origins (https://A and https://a are distinct)', () => {
    const result = parseAllowedOrigins('https://A.example,https://a.example');
    expect(result).toEqual(['https://A.example', 'https://a.example']);
  });

  it('returns a frozen array', () => {
    const result = parseAllowedOrigins('https://example.com');
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('resolveDemoPasswordParamName', () => {
  it('returns the trimmed parameter name when set', () => {
    expect(
      resolveDemoPasswordParamName('  /finance-coach-latam/demo-password  '),
    ).toBe('/finance-coach-latam/demo-password');
  });

  it('throws when the env var is unset (fail closed for the migration Lambda)', () => {
    expect(() => resolveDemoPasswordParamName(undefined)).toThrow(
      /DEMO_PASSWORD_PARAM_NAME is required/,
    );
  });

  it('throws when the env var is blank', () => {
    expect(() => resolveDemoPasswordParamName('   ')).toThrow(
      /DEMO_PASSWORD_PARAM_NAME is required/,
    );
  });
});
