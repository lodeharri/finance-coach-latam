/**
 * CDK stack test — FinanceCoachStack API Gateway routes.
 *
 * Pins the contract for HTTP API v2 route registrations. The lambdas exist
 * for every mutation use case, but missing addRoutes() calls leave the
 * corresponding methods returning HTTP 404 at the API Gateway edge (the
 * request never reaches the Lambda). This test fails fast at synth time
 * whenever an idempotent path is missing from the stack.
 *
 * Bug being prevented: Issue 1 in fix/delete-routes-form-pesos-mobile —
 * DELETE /users/{id} returning 404 while DELETE /categories/{id} works.
 *
 * Also pins per-route throttling limits on the API Gateway v2 stage.
 * Free-tier cost protection: the default 10,000 RPS sustained throttle is
 * too high for a portfolio demo — a DoS could cost real money. Per-route
 * limits block obvious abuse while still letting a normal user do 5 req/sec
 * for 5 seconds (25 req burst, well inside every limit here).
 */
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { FinanceCoachStack } from '../lib/finance-coach-stack';

interface RouteDefinition {
  readonly RouteKey: string;
  readonly AuthorizationType?: string;
  readonly Target?: unknown;
}

interface RouteResource {
  readonly Properties: RouteDefinition;
}

interface RouteSettings {
  readonly ThrottlingBurstLimit?: number;
  readonly ThrottlingRateLimit?: number;
}

interface StageProperties {
  readonly DefaultRouteSettings?: RouteSettings;
  readonly RouteSettings?: Record<string, RouteSettings>;
}

interface StageResource {
  readonly Properties: StageProperties;
}

interface LogGroupProperties {
  readonly RetentionInDays?: number;
}

interface LogGroupResource {
  readonly Properties: LogGroupProperties;
}

/**
 * Per-route throttle limits declared in `finance-coach-stack.ts`. These are
 * the source of truth — the test asserts the synthesized CfnStage contains
 * exactly these keys with exactly these values.
 *
 * Numbers chosen to be:
 *   - safe for free-tier cost (block scrapers / DoS)
 *   - high enough for normal human usage (browsing, paginating, bulk import)
 *
 * Reads are cheap; writes are expensive; admin / LLM-backed paths are tightest.
 */
const EXPECTED_ROUTE_THROTTLE: Record<string, RouteSettings> = {
  'GET /transactions': { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 50 },
  'GET /accounts': { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 20 },
  'GET /categories': { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 20 },
  'GET /users': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'POST /transactions': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'POST /accounts': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
  'POST /categories': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
  'PATCH /transactions/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'GET /transactions/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'DELETE /categories/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'DELETE /users/{id}': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 3 },
  'PATCH /categories/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
  'PATCH /accounts/{id}': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
  'POST /transactions/{id}/categorize': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 3 },
};

describe('FinanceCoachStack API Gateway routes', () => {
  const app = new App();
  const stack = new FinanceCoachStack(app, 'TestStack');
  const template = Template.fromStack(stack);
  const routeResources = template.findResources('AWS::ApiGatewayV2::Route') as Record<string, RouteResource>;

  /**
   * Synthesized HTTP API v2 routes produce a `RouteKey` of the form
   * `"<METHOD> <path>"` — e.g. `"DELETE /users/{id}"`. The CDK `addRoutes()`
   * helper appends the method to the user-supplied path so this string is
   * stable across runs.
   */
  function routeKeysForPath(path: string): string[] {
    return Object.values(routeResources)
      .map((r) => r.Properties.RouteKey)
      .filter((key): key is string => typeof key === 'string')
      .filter((key) => key.endsWith(` ${path}`));
  }

  function methodsForPath(path: string): string[] {
    return routeKeysForPath(path)
      .map((key) => key.split(' ')[0]!)
      .sort();
  }

  it('registers DELETE /users/{id} (regression for Issue 1: blocking 404 on user delete)', () => {
    const keys = routeKeysForPath('/users/{id}');
    expect(keys).toContain('DELETE /users/{id}');
    expect(methodsForPath('/users/{id}')).toEqual(
      expect.arrayContaining(['DELETE']),
    );
  });

  it('registers PATCH /users/{id} (forward-compatible companion)', () => {
    const keys = routeKeysForPath('/users/{id}');
    expect(keys).toContain('PATCH /users/{id}');
  });

  it('registers DELETE /accounts/{id} (same gap as /users, not blocking)', () => {
    expect(routeKeysForPath('/accounts/{id}')).toContain('DELETE /accounts/{id}');
  });

  it('registers PATCH /accounts/{id} (forward-compatible companion)', () => {
    expect(routeKeysForPath('/accounts/{id}')).toContain('PATCH /accounts/{id}');
  });

  it('still wires /categories/{id} PATCH + DELETE so the prior contract is preserved', () => {
    const methods = methodsForPath('/categories/{id}');
    expect(methods).toEqual(expect.arrayContaining(['DELETE', 'PATCH']));
  });

  // Polling fix — the per-transaction polling endpoint (used by
  // useCategorizationStatus after a create) was returning 404 at the
  // gateway edge because only PATCH was registered. Pin BOTH methods
  // here so the regression cannot reappear.
  it('registers GET and PATCH on /transactions/{id} (per-tx polling fix)', () => {
    const methods = methodsForPath('/transactions/{id}');
    expect(methods).toEqual(expect.arrayContaining(['GET', 'PATCH']));
  });
});

describe('FinanceCoachStack API Gateway per-route throttling', () => {
  const app = new App();
  const stack = new FinanceCoachStack(app, 'TestStackThrottle');
  const template = Template.fromStack(stack);
  const stageResources = template.findResources('AWS::ApiGatewayV2::Stage') as Record<string, StageResource>;

  /**
   * The HTTP API v2 default stage is the only CfnStage the stack emits.
   * Stage-level throttle overrides live in `RouteSettings` (per-route) and
   * `DefaultRouteSettings` (fallback for any route without an entry).
   */
  function getDefaultStage(): StageResource {
    const entries = Object.values(stageResources);
    expect(entries).toHaveLength(1);
    const stage = entries[0]!;
    expect(stage.Properties.RouteSettings).toBeDefined();
    return stage;
  }

  it('declares an explicit RouteSettings block on the CfnStage', () => {
    const stage = getDefaultStage();
    expect(stage.Properties.RouteSettings).toBeDefined();
    expect(Object.keys(stage.Properties.RouteSettings!)).not.toHaveLength(0);
  });

  it.each(Object.entries(EXPECTED_ROUTE_THROTTLE))(
    'applies throttle %i RPS / %i burst to route "%s"',
    (routeKey, expected) => {
      const stage = getDefaultStage();
      const routeSettings = stage.Properties.RouteSettings!;
      const actual = routeSettings[routeKey];
      expect(actual, `route "${routeKey}" missing from RouteSettings`).toBeDefined();
      expect(actual!.ThrottlingRateLimit).toBe(expected.ThrottlingRateLimit);
      expect(actual!.ThrottlingBurstLimit).toBe(expected.ThrottlingBurstLimit);
    },
  );

  it('does not declare any route in RouteSettings that is missing from the contract', () => {
    const stage = getDefaultStage();
    const declared = Object.keys(stage.Properties.RouteSettings!);
    const expected = new Set(Object.keys(EXPECTED_ROUTE_THROTTLE));
    const extra = declared.filter((k) => !expected.has(k));
    expect(extra, `extra routes in RouteSettings not declared in test contract: ${extra.join(', ')}`).toEqual([]);
  });
});

describe('FinanceCoachStack CloudWatch log retention', () => {
  /**
   * Every Lambda in the stack is a portfolio demo on the AWS free tier. The
   * 5 GB free CloudWatch Logs quota is plenty for a single demo, but if a
   * log group ships with the CDK default (INFINITE), every line of every
   * test invocation, every failed login, every DoS probe is kept forever
   * and eventually costs real money. This block pins the policy at synth
   * time: every `AWS::Logs::LogGroup` in the synthesized template must
   * have `RetentionInDays: 7`.
   */
  const app = new App();
  const stack = new FinanceCoachStack(app, 'TestStackLogRetention');
  const template = Template.fromStack(stack);
  const logGroups = template.findResources('AWS::Logs::LogGroup') as Record<string, LogGroupResource>;

  it('creates at least one CloudWatch log group (sanity check)', () => {
    expect(Object.keys(logGroups).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(logGroups))(
    'sets RetentionInDays=7 on log group "%s"',
    (logicalId, resource) => {
      expect(
        resource.Properties.RetentionInDays,
        `LogGroup ${logicalId} must have RetentionInDays=7 (free-tier cost protection)`,
      ).toBe(7);
    },
  );
});
