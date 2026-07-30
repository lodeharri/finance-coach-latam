import type { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import type { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
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

export interface UsersRoutesDeps {
  readonly tokenVerifier: TokenVerifierPort;
  readonly createUserUseCase: CreateUserUseCase;
  readonly listUsersUseCase: ListUsersUseCase;
}

export function createUsersRoutes(deps: UsersRoutesDeps): HttpRouteHandler {
  return async (event) => {
    try {
      const actor = await authenticate(event, deps.tokenVerifier);
      const method = event.requestContext.http.method;

      if (method === 'GET') {
        const users = await deps.listUsersUseCase.execute({ actorRole: actor.role });
        return jsonResponse(200, users);
      }

      if (method === 'POST') {
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
        return jsonResponse(201, user);
      }

      throw new HttpError(405, `Method ${method} is not allowed on /users`);
    } catch (error) {
      return routeError(error);
    }
  };
}
