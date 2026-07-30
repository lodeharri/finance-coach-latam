import { createRemoteJWKSet, jwtVerify } from 'jose';
import type {
  TokenVerifierPort,
  VerifiedToken,
} from '../../domain/ports/auth.port';

export interface JwtVerifierConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

export class JwtVerifierAdapter implements TokenVerifierPort {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: JwtVerifierConfig) {
    this.issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verifyJwt(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.config.userPoolClientId,
        algorithms: ['RS256'],
      });
      if (payload.token_use !== 'id') {
        throw new Error('expected a Cognito ID token');
      }

      const userId = payload.sub;
      const email = payload.email;
      if (!userId || typeof email !== 'string') {
        throw new Error('token is missing sub or email claims');
      }

      const claim = payload['cognito:groups'];
      const groups = Array.isArray(claim)
        ? claim.filter((group): group is string => typeof group === 'string')
        : [];
      const role = groups.includes('admins')
        ? 'admin'
        : groups.includes('users')
          ? 'user'
          : undefined;
      if (!role) {
        throw new Error('token has no recognized Cognito group');
      }

      return { userId, email, role };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`JwtVerifierAdapter.verifyJwt: ${message}`);
    }
  }
}
