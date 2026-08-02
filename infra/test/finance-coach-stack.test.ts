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
});
