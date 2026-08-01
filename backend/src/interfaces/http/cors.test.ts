import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/infrastructure/config/env.config', () => {
  return {
    getConfig: () => ({
      cors: {
        allowedOrigins: [
          'https://finance-coach-latam.pages.dev',
          'http://localhost:5173',
        ],
      },
    }),
  };
});

import { corsHeadersFor, jsonResponse } from './http.utils';

function makeHeaders(origin: string | undefined): APIGatewayProxyEventV2['headers'] {
  if (origin === undefined) return {};
  return { origin };
}

describe('corsHeadersFor', () => {
  it('echoes an allowed origin and adds Vary: Origin', () => {
    const headers = corsHeadersFor(makeHeaders('https://finance-coach-latam.pages.dev'));
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://finance-coach-latam.pages.dev',
    );
    expect(headers['Vary']).toBe('Origin');
    expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('echoes the local dev origin when the SPA runs on Vite', () => {
    const headers = corsHeadersFor(makeHeaders('http://localhost:5173'));
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('OMITS Access-Control-Allow-Origin for a disallowed origin', () => {
    const headers = corsHeadersFor(makeHeaders('https://evil.example'));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    // Vary: Origin must STILL be present so caches do not cross-leak.
    expect(headers['Vary']).toBe('Origin');
  });

  it('OMITS Access-Control-Allow-Origin when no Origin header is sent', () => {
    const headers = corsHeadersFor({});
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers['Vary']).toBe('Origin');
  });

  it('tolerates canonical-case "Origin" header (direct invocation, not API GW)', () => {
    const headers = corsHeadersFor({ Origin: 'https://finance-coach-latam.pages.dev' });
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://finance-coach-latam.pages.dev',
    );
  });

  it('never returns "*" as Access-Control-Allow-Origin', () => {
    for (const candidate of [
      undefined,
      '',
      'https://finance-coach-latam.pages.dev',
      'http://localhost:5173',
      'https://attacker.example',
    ]) {
      const headers = corsHeadersFor(makeHeaders(candidate));
      expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
    }
  });
});

describe('jsonResponse', () => {
  it('echoes an allowed origin when called with the event', () => {
    const result = jsonResponse(
      200,
      { ok: true },
      {
        version: '2.0',
        routeKey: '$default',
        rawPath: '/health',
        rawQueryString: '',
        headers: { origin: 'http://localhost:5173' },
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-id',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: { method: 'GET', path: '/health', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
          requestId: 'req-1',
          routeKey: '$default',
          stage: '$default',
          time: '01/Jan/2026:00:00:00 +0000',
          timeEpoch: 0,
        },
        body: undefined,
        isBase64Encoded: false,
      },
    );
    expect(result.headers!['Access-Control-Allow-Origin']).toBe(
      'http://localhost:5173',
    );
    expect(result.headers!['Content-Type']).toBe('application/json');
  });

  it('OMITS Access-Control-Allow-Origin for a disallowed origin', () => {
    const result = jsonResponse(
      403,
      { error: 'Forbidden' },
      {
        version: '2.0',
        routeKey: '$default',
        rawPath: '/x',
        rawQueryString: '',
        headers: { origin: 'https://evil.example' },
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-id',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: { method: 'GET', path: '/x', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
          requestId: 'req-2',
          routeKey: '$default',
          stage: '$default',
          time: '01/Jan/2026:00:00:00 +0000',
          timeEpoch: 0,
        },
        body: undefined,
        isBase64Encoded: false,
      },
    );
    expect(result.headers!['Access-Control-Allow-Origin']).toBeUndefined();
    expect(result.headers!['Vary']).toBe('Origin');
  });
});
