import type { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import type { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import type { ListTransactionsByUserUseCase } from '../../application/use-cases/list-transactions-by-user.use-case';
import type { UpdateTransactionCategoryUseCase } from '../../application/use-cases/update-transaction.use-case';
import {
  authenticate,
  HttpError,
  jsonResponse,
  parseBody,
  requiredString,
  routeError,
  targetUserId,
  type HttpRouteHandler,
} from './http.utils';

/**
 * Upper bound on the `limit` query parameter accepted by GET /transactions.
 *
 * Bumped from 100 to 200 so InsightsPage's 12-month trend can fetch enough
 * transactions to render a meaningful yearly series without hitting a 400.
 * 200 still bounds the response payload for free-tier cost discipline and
 * protects the Lambda + Neon connection pool from accidental unbounded reads.
 */
const MAX_LIST_LIMIT = 200;

export interface TransactionsRoutesDeps {
  readonly createTransactionUseCase: CreateTransactionUseCase;
  readonly categorizeTransactionUseCase: CategorizeTransactionUseCase;
  readonly listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
  readonly updateTransactionCategoryUseCase: UpdateTransactionCategoryUseCase;
}

export function createTransactionsRoutes(
  deps: TransactionsRoutesDeps,
): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = authenticate(event);
      const method = event.requestContext.http.method;
      const categorizeMatch = event.rawPath.match(
        /^\/transactions\/([^/]+)\/categorize$/,
      );

      if (method === 'POST' && categorizeMatch) {
        const body = parseBody(event);
        const userId = targetUserId(actor, body.userId);
        const transaction = await deps.categorizeTransactionUseCase.execute({
          actor,
          transactionId: decodeURIComponent(categorizeMatch[1]!),
          userId,
        });
        return jsonResponse(200, transaction, event);
      }

      // REQ-FFC-BE-PATCH-TRANSACTION: owner/admin override on a single
      // transaction. The use case loads by id and asserts the actor owns
      // the row (or is admin), so a spoofed userId in the body cannot
      // bypass the check (REQ-FFC-AUTH-TX-OWNER).
      const updateMatch = event.rawPath.match(/^\/transactions\/([^/]+)$/);
      if (method === 'PATCH' && updateMatch) {
        const body = parseBody(event);
        const categoryId = requiredString(body, 'categoryId');
        const transaction = await deps.updateTransactionCategoryUseCase.execute({
          actor,
          transactionId: decodeURIComponent(updateMatch[1]!),
          categoryId,
        });
        return jsonResponse(200, transaction, event);
      }

      if (event.rawPath !== '/transactions') {
        throw new HttpError(404, 'Transaction route not found');
      }

      if (method === 'GET') {
        const userId = targetUserId(actor, event.queryStringParameters?.userId);
        const rawLimit = event.queryStringParameters?.limit;
        const limit = rawLimit === undefined ? undefined : Number(rawLimit);
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT)) {
          throw new HttpError(400, `limit must be an integer between 1 and ${MAX_LIST_LIMIT}`);
        }
        const transactions = await deps.listTransactionsByUserUseCase.execute({
          actor,
          userId,
          limit,
        });
        return jsonResponse(200, transactions, event);
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const userId = targetUserId(actor, body.userId);
        const amountCents = body.amountCents;
        if (typeof amountCents !== 'number' || !Number.isInteger(amountCents)) {
          throw new HttpError(400, 'Field "amountCents" must be an integer');
        }
        const occurredAt = new Date(requiredString(body, 'occurredAt'));
        if (Number.isNaN(occurredAt.getTime())) {
          throw new HttpError(400, 'Field "occurredAt" must be an ISO date');
        }
        const notes = body.notes;
        if (notes !== undefined && typeof notes !== 'string') {
          throw new HttpError(400, 'Field "notes" must be a string');
        }
        const transaction = await deps.createTransactionUseCase.execute({
          actor,
          userId,
          accountId: requiredString(body, 'accountId'),
          merchant: requiredString(body, 'merchant'),
          amountCents,
          occurredAt,
          notes,
        });
        return jsonResponse(201, transaction, event);
      }

      throw new HttpError(405, `Method ${method} is not allowed on /transactions`);
    } catch (error) {
      return routeError(error, event);
    }
  };
}