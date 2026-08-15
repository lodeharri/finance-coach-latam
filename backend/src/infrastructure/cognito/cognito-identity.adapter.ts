import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import type {
  AuthPort,
  CreateIdentityInput,
  IdentityUser,
} from '../../domain/ports/cognito.port';

export interface CognitoIdentityConfig {
  readonly region: string;
  readonly userPoolId: string;
}

export class CognitoIdentityAdapter implements AuthPort {
  private readonly client: CognitoIdentityProviderClient;
  private readonly usernamesByUserId = new Map<string, string>();

  constructor(
    private readonly config: CognitoIdentityConfig,
    client?: CognitoIdentityProviderClient,
  ) {
    this.client = client ?? new CognitoIdentityProviderClient({ region: config.region });
  }

  async createUser(input: CreateIdentityInput): Promise<{ userId: string }> {
    if (input.role !== 'admin' && input.role !== 'user') {
      throw new Error(`CognitoIdentityAdapter: invalid role "${String(input.role)}"`);
    }

    const response = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.config.userPoolId,
        Username: input.email,
        TemporaryPassword: input.tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: input.name },
        ],
      }),
    );
    const userId = this.attribute(response.User, 'sub');
    const username = response.User?.Username;
    if (!userId || !username) {
      throw new Error('CognitoIdentityAdapter.createUser: Cognito returned no user identity');
    }

    this.usernamesByUserId.set(userId, username);
    return { userId };
  }

  async addUserToGroup(userId: string, groupName: string): Promise<void> {
    const username =
      this.usernamesByUserId.get(userId) ??
      (await this.findUserByFilter('sub', userId))?.Username;
    if (!username) {
      throw new Error(`CognitoIdentityAdapter.addUserToGroup: user "${userId}" not found`);
    }

    await this.client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.config.userPoolId,
        Username: username,
        GroupName: groupName,
      }),
    );
  }

  async getUserByEmail(email: string): Promise<IdentityUser | null> {
    const user = await this.findUserByFilter('email', email);
    const username = user?.Username;
    const userId = this.attribute(user, 'sub');
    if (!user || !username || !userId) return null;

    const response = await this.client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: this.config.userPoolId,
        Username: username,
      }),
    );

    return {
      userId,
      email: this.attribute(user, 'email') ?? email,
      groups: (response.Groups ?? []).flatMap((group) =>
        group.GroupName ? [group.GroupName] : [],
      ),
    };
  }

  async deleteUser(userId: string): Promise<void> {
    const username =
      this.usernamesByUserId.get(userId) ??
      (await this.findUserByFilter('sub', userId))?.Username;
    if (!username) {
      throw new Error(`CognitoIdentityAdapter.deleteUser: user "${userId}" not found`);
    }

    await this.client.send(
      new AdminDeleteUserCommand({
        UserPoolId: this.config.userPoolId,
        Username: username,
      }),
    );
    this.usernamesByUserId.delete(userId);
  }

  private async findUserByFilter(
    attribute: 'email' | 'sub',
    value: string,
  ): Promise<UserType | undefined> {
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    const response = await this.client.send(
      new ListUsersCommand({
        UserPoolId: this.config.userPoolId,
        Filter: `${attribute} = "${escaped}"`,
        Limit: 1,
      }),
    );
    return response.Users?.[0];
  }

  private attribute(user: UserType | undefined, name: string): string | undefined {
    return user?.Attributes?.find((attribute) => attribute.Name === name)?.Value;
  }
}
