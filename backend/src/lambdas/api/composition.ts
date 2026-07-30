import { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case';
import { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { ListAccountsByUserUseCase } from '../../application/use-cases/list-accounts-by-user.use-case';
import { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import { ListTransactionsByUserUseCase } from '../../application/use-cases/list-transactions-by-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import { JwtVerifierAdapter } from '../../infrastructure/auth/jwt-verifier.adapter';
import { CognitoIdentityAdapter } from '../../infrastructure/cognito/cognito-identity.adapter';
import { getConfig } from '../../infrastructure/config/env.config';
import {
  accountTableRef,
  categoryTableRef,
  transactionTableRef,
  userTableRef,
} from '../../infrastructure/database/drizzle/schema';
import { MerchantCacheAdapter } from '../../infrastructure/database/merchant-cache.adapter';
import { NeonDatabaseAdapter } from '../../infrastructure/database/neon-database.adapter';
import { createLLMProvider } from '../../infrastructure/llm/llm.factory';
import { SQSPublisherAdapter } from '../../infrastructure/queue/sqs-publisher.adapter';
import { createApiRoutes } from '../../interfaces/http/api.routes';

export function buildApiComposition() {
  const config = getConfig();
  if (!config.cognito.userPoolId || !config.cognito.userPoolClientId) {
    throw new Error(
      'COGNITO_USER_POOL_ID and COGNITO_USER_POOL_CLIENT_ID are required for the API Lambda',
    );
  }

  const categorizerQueueUrl = process.env.CATEGORIZER_QUEUE_URL;
  if (!categorizerQueueUrl) {
    throw new Error(
      'CATEGORIZER_QUEUE_URL is required for the API Lambda to enqueue categorizations.',
    );
  }

  const database = new NeonDatabaseAdapter(config.databaseUrl);
  const llm = createLLMProvider(config.llm);
  const auth = new CognitoIdentityAdapter(config.cognito);
  const tokenVerifier = new JwtVerifierAdapter(config.cognito);
  const queuePublisher = new SQSPublisherAdapter({ region: config.awsRegion });
  const merchantCache = new MerchantCacheAdapter(database);

  return createApiRoutes({
    tokenVerifier,
    createUserUseCase: new CreateUserUseCase(database, auth, userTableRef),
    listUsersUseCase: new ListUsersUseCase(database, userTableRef),
    createAccountUseCase: new CreateAccountUseCase(database, accountTableRef),
    listAccountsByUserUseCase: new ListAccountsByUserUseCase(
      database,
      accountTableRef,
    ),
    listCategoriesUseCase: new ListCategoriesUseCase(database, categoryTableRef),
    createCategoryUseCase: new CreateCategoryUseCase(database, categoryTableRef, llm),
    createTransactionUseCase: new CreateTransactionUseCase(
      database,
      transactionTableRef,
      accountTableRef,
      queuePublisher,
      categorizerQueueUrl,
    ),
    categorizeTransactionUseCase: new CategorizeTransactionUseCase(
      database,
      llm,
      transactionTableRef,
      merchantCache,
    ),
    listTransactionsByUserUseCase: new ListTransactionsByUserUseCase(
      database,
      transactionTableRef,
    ),
  });
}

export const handler = buildApiComposition();