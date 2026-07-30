import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type {
  CategorizeTransactionUseCase,
} from '../../application/use-cases/categorize-transaction.use-case';
import type { Actor } from '../../application/use-cases/authorization';

export interface CategorizerHandlerDeps {
  readonly categorizeTransactionUseCase: CategorizeTransactionUseCase;
  readonly actor: Actor;
}

interface CategorizerMessage {
  readonly transactionId?: unknown;
  readonly userId?: unknown;
}

export type CategorizerHandler = (event: SQSEvent) => Promise<SQSBatchResponse>;

export function buildCategorizerHandler(
  deps: CategorizerHandlerDeps,
): CategorizerHandler {
  return async (event) => {
    const failures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
      try {
        const payload = parseMessage(record.body);
        if (!payload.transactionId || !payload.userId) {
          throw new Error(
            `CategorizerHandler: message missing transactionId or userId (messageId=${record.messageId})`,
          );
        }

        await deps.categorizeTransactionUseCase.execute({
          actor: deps.actor,
          transactionId: String(payload.transactionId),
          userId: String(payload.userId),
        });
        console.log(
          `[categorizer] Categorized transaction ${payload.transactionId} for user ${payload.userId} (messageId=${record.messageId})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[categorizer] Failed to process message ${record.messageId}: ${message}`,
        );
        failures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures: failures };
  };
}

function parseMessage(body: string | undefined): CategorizerMessage {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as CategorizerMessage;
    }
    return {};
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`CategorizerHandler: invalid JSON body: ${detail}`);
  }
}