import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type { TokenVerifierPort } from '../../domain/ports/auth.port';
import {
  authenticate,
  HttpError,
  jsonResponse,
  routeError,
  type HttpRouteHandler,
} from './http.utils';

export interface CategoriesRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly listCategoriesUseCase: ListCategoriesUseCase;
}

export function createCategoriesRoutes(deps: CategoriesRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      await authenticate(event, deps.tokenVerifier);
      const method = event.requestContext.http.method;
      if (method !== 'GET') {
        throw new HttpError(405, `Method ${method} is not allowed on /categories`);
      }
      return jsonResponse(200, await deps.listCategoriesUseCase.execute());
    } catch (error) {
      return routeError(error);
    }
  };
}
