import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CognitoDemoUsersBootstrap } from './cognito-bootstrap';
import { readDemoPassword } from './ssm';

vi.mock('./ssm', () => ({ readDemoPassword: vi.fn() }));

const DEMO_PASSWORD_PARAM_NAME = '/finance-coach-latam/demo-password';

type SendMock = Mock<(command: unknown) => Promise<unknown>>;

function mockCognitoSend(): SendMock {
  const send = vi.spyOn(
    CognitoIdentityProviderClient.prototype,
    'send',
  ) as unknown as SendMock;
  send.mockImplementation(async (command: unknown) => {
    if (command instanceof AdminGetUserCommand) {
      throw Object.assign(new Error('UserNotFoundException'), {
        name: 'UserNotFoundException',
      });
    }
    if (command instanceof AdminCreateUserCommand) {
      const username = command.input.Username ?? 'unknown';
      return {
        User: {
          Username: username,
          Attributes: [{ Name: 'sub', Value: `sub-${username}` }],
        },
      };
    }
    if (
      command instanceof AdminSetUserPasswordCommand ||
      command instanceof AdminAddUserToGroupCommand
    ) {
      return {};
    }
    throw new Error(`Unexpected command: ${String(command?.constructor?.name)}`);
  });
  return send;
}

describe('CognitoDemoUsersBootstrap', () => {
  const readPasswordMock = vi.mocked(readDemoPassword);

  beforeEach(() => {
    readPasswordMock.mockReset();
    readPasswordMock.mockResolvedValue('s3cret-from-ssm');
  });

  it('fetches the SSM parameter once and forces the same password on both demo users', async () => {
    const send = mockCognitoSend();
    const bootstrap = new CognitoDemoUsersBootstrap(
      new CognitoIdentityProviderClient({ region: 'us-east-1' }),
      new (class {})() as never,
      'pool-id',
      DEMO_PASSWORD_PARAM_NAME,
    );

    const result = await bootstrap.ensureUsers();

    expect(result).toEqual({
      adminUserId: 'sub-admin@portfolio.dev',
      regularUserId: 'sub-user@portfolio.dev',
    });
    expect(readPasswordMock).toHaveBeenCalledTimes(1);
    expect(readPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      DEMO_PASSWORD_PARAM_NAME,
    );

    const setPassword = send.mock.calls
      .map(([command]) => command)
      .filter(
        (command): command is AdminSetUserPasswordCommand =>
          command instanceof AdminSetUserPasswordCommand,
      );
    expect(setPassword).toHaveLength(2);
    expect(setPassword.map((command) => command.input.Password)).toEqual([
      's3cret-from-ssm',
      's3cret-from-ssm',
    ]);
    expect(setPassword.map((command) => command.input.Username)).toEqual([
      'admin@portfolio.dev',
      'user@portfolio.dev',
    ]);
    expect(setPassword.every((command) => command.input.Permanent === true)).toBe(
      true,
    );
  });

  it('propagates SSM failures so the deploy fails closed', async () => {
    mockCognitoSend();
    readPasswordMock.mockRejectedValueOnce(
      new Error('SSM parameter /finance-coach-latam/demo-password returned no value'),
    );
    const bootstrap = new CognitoDemoUsersBootstrap(
      new CognitoIdentityProviderClient({ region: 'us-east-1' }),
      new (class {})() as never,
      'pool-id',
      DEMO_PASSWORD_PARAM_NAME,
    );

    await expect(bootstrap.ensureUsers()).rejects.toThrow(
      'SSM parameter /finance-coach-latam/demo-password returned no value',
    );
  });
});
