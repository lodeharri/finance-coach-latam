import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import type { LLMPort } from '../../domain/ports/llm.port';
import { runMigrations, type MigrationsFolder } from './migrate';
import { runSeed } from './seed';
import type { CognitoDemoUsersBootstrap } from './cognito-bootstrap';

export type RequestType = 'Create' | 'Update' | 'Delete';

export interface MigrationEvent {
  RequestType: RequestType;
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceType: string;
  ResourceProperties: Record<string, unknown>;
  OldResourceProperties?: Record<string, unknown>;
  ServiceToken: string;
}

export interface MigrationHandlerDeps {
  db: NeonHttpDatabase;
  migrationsFolder: MigrationsFolder;
  demoUsersBootstrap: CognitoDemoUsersBootstrap;
  llm: LLMPort;
}

export type MigrationHandler = (event: MigrationEvent) => Promise<void>;

export function buildMigrationHandler(deps: MigrationHandlerDeps): MigrationHandler {
  return async (event) => {
    const physicalResourceId = event.PhysicalResourceId ?? `migration-${event.RequestId}`;
    console.log(`[migration] Received ${event.RequestType} for ${event.LogicalResourceId}`);

    try {
      if (event.RequestType === 'Delete') {
        console.log('[migration] Delete request: skipping cleanup (preserve data on stack destroy).');
        await sendResponse(event, 'SUCCESS', physicalResourceId, undefined, {
          action: 'delete',
          message: 'no-op; data preserved',
        });
        return;
      }

      const applied = await runMigrations(deps.db, deps.migrationsFolder);
      const demoUsers = await deps.demoUsersBootstrap.ensureUsers();
      const seedInfo = await runSeed(deps.db, demoUsers, deps.llm);

      await sendResponse(event, 'SUCCESS', physicalResourceId, undefined, {
        action: event.RequestType.toLowerCase(),
        migrationsApplied: applied,
        seedInserted: seedInfo.inserted,
        seededUsers: seedInfo.users,
        seededCategories: seedInfo.categories,
        seededAccounts: seedInfo.accounts,
        seededTransactions: seedInfo.transactions,
        categoryEmbeddingsComputed: seedInfo.categoryEmbeddings,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[migration] FAILED:', message);
      try {
        await sendResponse(event, 'FAILED', physicalResourceId, message, undefined);
      } catch (sendError) {
        const sendMsg = sendError instanceof Error ? sendError.message : String(sendError);
        console.error('[migration] Failed to send FAILED response to CloudFormation:', sendMsg);
      }
      throw error;
    }
  };
}

type ResponseStatus = 'SUCCESS' | 'FAILED';

interface ResponsePayload {
  Status: ResponseStatus;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Reason?: string;
  Data?: Record<string, unknown>;
}

async function sendResponse(
  event: MigrationEvent,
  status: ResponseStatus,
  physicalResourceId: string,
  reason: string | undefined,
  data: Record<string, unknown> | undefined,
): Promise<void> {
  const payload: ResponsePayload = {
    Status: status,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  if (reason) {
    payload.Reason = reason.slice(0, 4096);
  }
  if (data) {
    payload.Data = data;
  }

  const body = JSON.stringify(payload);
  const url = new URL(event.ResponseURL);

  await new Promise<void>((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'PUT',
        headers: {
          'content-type': '',
          'content-length': Buffer.byteLength(body).toString(),
        },
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        console.log(`[migration] CloudFormation ResponseURL status: ${statusCode}`);
        res.on('data', () => {});
        res.on('end', () => resolve());
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
