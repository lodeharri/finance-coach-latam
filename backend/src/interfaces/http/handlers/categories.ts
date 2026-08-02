import type { CreateCategoryUseCase } from '../../../application/use-cases/create-category.use-case';
import type { DeleteCategoryUseCase } from '../../../application/use-cases/delete-category.use-case';
import type { ListCategoriesUseCase } from '../../../application/use-cases/list-categories.use-case';
import type { UpdateCategoryUseCase } from '../../../application/use-cases/update-category.use-case';
import {
  authenticate,
  HttpError,
  jsonResponse,
  parseBody,
  requiredString,
  routeError,
  type HttpRouteHandler,
} from '../http.utils';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export interface CategoriesRoutesDeps {
  readonly listCategoriesUseCase: ListCategoriesUseCase;
  readonly createCategoryUseCase: CreateCategoryUseCase;
  readonly updateCategoryUseCase: UpdateCategoryUseCase;
  readonly deleteCategoryUseCase: DeleteCategoryUseCase;
}

export function createCategoriesRoutes(deps: CategoriesRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = authenticate(event);
      const method = event.requestContext.http.method;
      const idMatch = /^\/categories\/[^/]+$/.test(event.rawPath);
      const pathId = idMatch ? event.rawPath.split('/').pop()! : '';

      if (method === 'GET' && event.rawPath === '/categories') {
        return jsonResponse(200, await deps.listCategoriesUseCase.execute(), event);
      }

      if (method === 'POST' && event.rawPath === '/categories') {
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
          return jsonResponse(201, created, event);
        } catch (error) {
          // REQ-AC-002: the use case throws a plain Error with the
          // 'Category slug already exists: <slug>' prefix; re-throw as
          // HttpError(409) so the route surfaces the right status.
          if (
            error instanceof Error &&
            error.message.startsWith('Category slug already exists')
          ) {
            return routeError(new HttpError(409, error.message), event);
          }
          throw error;
        }
      }

      if (method === 'PATCH' && idMatch) {
        const body = parseBody(event);
        // Each field is optional, but if present must be a non-empty string
        // after trimming (REQ-AC-006). The use case re-validates as
        // defense-in-depth, so a 400 here means we caught it before any DB
        // work ran.
        const name =
          body.name === undefined
            ? undefined
            : typeof body.name === 'string' && body.name.trim().length > 0
              ? body.name.trim()
              : (() => {
                  throw new HttpError(
                    400,
                    'Field "name" must be a non-empty string',
                  );
                })();
        const color =
          body.color === undefined
            ? undefined
            : typeof body.color === 'string' && body.color.trim().length > 0
              ? body.color.trim()
              : (() => {
                  throw new HttpError(
                    400,
                    'Field "color" must be a non-empty string',
                  );
                })();
        if (name === undefined && color === undefined) {
          throw new HttpError(400, 'At least one of "name" or "color" is required');
        }
        if (color !== undefined && !HEX_COLOR.test(color)) {
          throw new HttpError(400, 'Field "color" must be a hex color like #AABBCC');
        }
        const updated = await deps.updateCategoryUseCase.execute({
          actor,
          id: pathId,
          patch: { name, color },
        });
        return jsonResponse(200, updated, event);
      }

      if (method === 'DELETE' && idMatch) {
        try {
          await deps.deleteCategoryUseCase.execute({ actor, id: pathId });
        } catch (error) {
          // REQ-AC-007: the use case maps Postgres FK violations to a
          // stable 'Category in use by transactions' prefix; surface as
          // 409 so callers can recover (e.g. unassign transactions
          // first, retry).
          if (
            error instanceof Error &&
            error.message.startsWith('Category in use by transactions')
          ) {
            return routeError(new HttpError(409, error.message), event);
          }
          throw error;
        }
        return jsonResponse(204, {}, event);
      }

      throw new HttpError(405, `Method ${method} is not allowed on ${event.rawPath}`);
    } catch (error) {
      return routeError(error, event);
    }
  };
}
