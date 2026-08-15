import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { SSMClient } from '@aws-sdk/client-ssm';
import { readDemoPassword } from './ssm';

export interface DemoUserIds {
  readonly adminUserId: string;
  readonly regularUserId: string;
}

interface DemoUser {
  readonly email: string;
  readonly name: string;
  readonly group: 'admins' | 'users';
}

const DEMO_USERS: readonly DemoUser[] = [
  { email: 'admin@portfolio.dev', name: 'Admin Demo', group: 'admins' },
  { email: 'user@portfolio.dev', name: 'Usuario Demo', group: 'users' },
];

export class CognitoDemoUsersBootstrap {
  private password?: string;

  constructor(
    private readonly client: CognitoIdentityProviderClient,
    private readonly ssmClient: SSMClient,
    private readonly userPoolId: string,
    private readonly passwordParamName: string,
  ) {}

  async ensureUsers(): Promise<DemoUserIds> {
    const password = (this.password ??= await readDemoPassword(
      this.ssmClient,
      this.passwordParamName,
    ));
    const [adminUserId, regularUserId] = await Promise.all(
      DEMO_USERS.map((user) => this.ensureUser(user, password)),
    );
    return { adminUserId, regularUserId };
  }

  private async ensureUser(user: DemoUser, password: string): Promise<string> {
    let existing = await this.getUser(user.email);
    if (!existing) {
      try {
        const created = await this.client.send(
          new AdminCreateUserCommand({
            UserPoolId: this.userPoolId,
            Username: user.email,
            TemporaryPassword: password,
            MessageAction: 'SUPPRESS',
            UserAttributes: [
              { Name: 'email', Value: user.email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: user.name },
            ],
          }),
        );
        existing = {
          username: created.User?.Username ?? user.email,
          attributes: created.User?.Attributes ?? [],
        };
      } catch (error) {
        if (!this.hasName(error, 'UsernameExistsException')) throw error;
        existing = await this.getUser(user.email);
      }
    }
    if (!existing) {
      throw new Error(`Cognito bootstrap could not resolve ${user.email}`);
    }

    await this.client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: existing.username,
        Password: password,
        Permanent: true,
      }),
    );
    await this.client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: existing.username,
        GroupName: user.group,
      }),
    );

    const userId = this.attribute(existing.attributes, 'sub');
    if (!userId) {
      throw new Error(`Cognito bootstrap user ${user.email} has no sub attribute`);
    }
    return userId;
  }

  private async getUser(
    username: string,
  ): Promise<{ username: string; attributes: AttributeType[] } | null> {
    try {
      const response = await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
      return {
        username: response.Username ?? username,
        attributes: response.UserAttributes ?? [],
      };
    } catch (error) {
      if (this.hasName(error, 'UserNotFoundException')) return null;
      throw error;
    }
  }

  private attribute(attributes: AttributeType[], name: string): string | undefined {
    return attributes.find((attribute) => attribute.Name === name)?.Value;
  }

  private hasName(error: unknown, name: string): boolean {
    return typeof error === 'object' && error !== null && 'name' in error && error.name === name;
  }
}
