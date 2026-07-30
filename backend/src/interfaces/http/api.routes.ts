import type { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import type { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import type { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import type { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import type { ListAccountsByUserUseCase } from '../../application/use-cases/list-accounts-by-user.use-case';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type { ListTransactionsByUserUseCase } from '../../application/use-cases/list-transactions-by-user.use-case';
import type { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import type { TokenVerifierPort } from '../../domain/ports/auth.port';
import { createAccountsRoutes } from './accounts.routes';
import { createCategoriesRoutes } from './categories.routes';
import { jsonResponse, type HttpRouteHandler } from './http.utils';
import { createTransactionsRoutes } from './transactions.routes';
import { createUsersRoutes } from './users.routes';

export interface ApiRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly createUserUseCase: CreateUserUseCase;
  readonly listUsersUseCase: ListUsersUseCase;
  readonly createAccountUseCase: CreateAccountUseCase;
  readonly listAccountsByUserUseCase: ListAccountsByUserUseCase;
  readonly listCategoriesUseCase: ListCategoriesUseCase;
  readonly createCategoryUseCase: CreateCategoryUseCase;
  readonly createTransactionUseCase: CreateTransactionUseCase;
  readonly categorizeTransactionUseCase: CategorizeTransactionUseCase;
  readonly listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
}

export function createApiRoutes(deps: ApiRoutesDeps): HttpRouteHandler {
  const users = createUsersRoutes(deps);
  const accounts = createAccountsRoutes(deps);
  const categories = createCategoriesRoutes(deps);
  const transactions = createTransactionsRoutes(deps);

  return async (event) => {
    if (event.rawPath === '/users') return users(event);
    if (event.rawPath === '/accounts') return accounts(event);
    if (event.rawPath === '/categories') return categories(event);
    if (
      event.rawPath === '/transactions' ||
      /^\/transactions\/[^/]+\/categorize$/.test(event.rawPath)
    ) {
      return transactions(event);
    }
    return jsonResponse(404, { error: 'Route not found' });
  };
}
