import type { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case';
import type { ListAccountsByUserUseCase } from '../../application/use-cases/list-accounts-by-user.use-case';
import type { AccountType } from '../../domain/entities/account.entity';
import type { TokenVerifierPort } from '../../domain/ports/auth.port';
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

export interface AccountsRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly createAccountUseCase: CreateAccountUseCase;
  readonly listAccountsByUserUseCase: ListAccountsByUserUseCase;
}

export function createAccountsRoutes(deps: AccountsRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = await authenticate(event, deps.tokenVerifier);
      const method = event.requestContext.http.method;

      if (method === 'GET') {
        const userId = targetUserId(actor, event.queryStringParameters?.userId);
        const accounts = await deps.listAccountsByUserUseCase.execute({ actor, userId });
        return jsonResponse(200, accounts);
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const type = requiredString(body, 'type');
        if (!['BANK', 'CASH', 'CARD'].includes(type)) {
          throw new HttpError(400, 'Field "type" must be BANK, CASH, or CARD');
        }
        const userId = targetUserId(actor, body.userId);
        const account = await deps.createAccountUseCase.execute({
          actor,
          userId,
          name: requiredString(body, 'name'),
          type: type as AccountType,
        });
        return jsonResponse(201, account);
      }

      throw new HttpError(405, `Method ${method} is not allowed on /accounts`);
    } catch (error) {
      return routeError(error);
    }
  };
}
