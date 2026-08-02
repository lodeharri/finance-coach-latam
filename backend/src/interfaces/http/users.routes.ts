import type { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import type { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import type { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import {
  authenticate,
  HttpError,
  jsonResponse,
  parseBody,
  requiredString,
  routeError,
  type HttpRouteHandler,
} from './http.utils';

export interface UsersRoutesDeps {
  readonly createUserUseCase: CreateUserUseCase;
  readonly listUsersUseCase: ListUsersUseCase;
  readonly deleteUserUseCase: DeleteUserUseCase;
}

export function createUsersRoutes(deps: UsersRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = authenticate(event);
      const method = event.requestContext.http.method;
      const idMatch = /^\/users\/[^/]+$/.test(event.rawPath);
      const pathId = idMatch ? event.rawPath.split('/').pop()! : '';

      if (method === 'GET' && event.rawPath === '/users') {
        const users = await deps.listUsersUseCase.execute({ actorRole: actor.role });
        return jsonResponse(200, users, event);
      }

      if (method === 'POST' && event.rawPath === '/users') {
        if (actor.role !== 'admin') {
          throw new HttpError(403, 'forbidden: admin role required');
        }
        const body = parseBody(event);
        const role = requiredString(body, 'role');
        if (role !== 'admin' && role !== 'user') {
          throw new HttpError(400, 'Field "role" must be "admin" or "user"');
        }
        const user = await deps.createUserUseCase.execute({
          actorRole: actor.role,
          email: requiredString(body, 'email'),
          name: requiredString(body, 'name'),
          role,
          tempPassword: requiredString(body, 'tempPassword'),
        });
        return jsonResponse(201, user, event);
      }

      if (method === 'DELETE' && idMatch) {
        await deps.deleteUserUseCase.execute({ actor, id: pathId });
        return jsonResponse(204, {}, event);
      }

      throw new HttpError(405, `Method ${method} is not allowed on ${event.rawPath}`);
    } catch (error) {
      return routeError(error, event);
    }
  };
}
