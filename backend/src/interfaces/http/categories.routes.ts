import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type { TokenVerifierPort } from '../../domain/ports/auth.port';
import {
  authenticate,
  HttpError,
  jsonResponse,
  parseBody,
  requiredString,
  routeError,
  type HttpRouteHandler,
} from './http.utils';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export interface CategoriesRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly listCategoriesUseCase: ListCategoriesUseCase;
  readonly createCategoryUseCase: CreateCategoryUseCase;
}

export function createCategoriesRoutes(deps: CategoriesRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = await authenticate(event, deps.tokenVerifier);
      const method = event.requestContext.http.method;

      if (method === 'GET') {
        return jsonResponse(200, await deps.listCategoriesUseCase.execute());
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const slug = requiredString(body, 'slug');
        const name = requiredString(body, 'name');
        const color = requiredString(body, 'color');
        // Pre-validate the hex color at the route layer so the use case never
        // runs for an obvious 400 (REQ-AC-005). The use case also checks the
        // same regex as defense-in-depth.
        if (!HEX_COLOR.test(color)) {
          throw new HttpError(400, 'Field "color" must be a hex color like #AABBCC');
        }
        try {
          const created = await deps.createCategoryUseCase.execute({
            actor,
            slug,
            name,
            color,
          });
          return jsonResponse(201, created);
        } catch (error) {
          // REQ-AC-002: the use case throws a plain Error with the
          // 'Category slug already exists: <slug>' prefix; re-throw as
          // HttpError(409) so the route surfaces the right status.
          if (
            error instanceof Error &&
            error.message.startsWith('Category slug already exists')
          ) {
            return routeError(new HttpError(409, error.message));
          }
          throw error;
        }
      }

      throw new HttpError(405, `Method ${method} is not allowed on /categories`);
    } catch (error) {
      return routeError(error);
    }
  };
}