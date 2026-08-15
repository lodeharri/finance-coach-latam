import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { readDemoPassword } from './ssm';

/**
 * The migration Lambda reads the demo password from SSM Parameter Store at
 * runtime. The helper must decrypt the value and FAIL CLOSED: a missing
 * parameter, an empty value, or an AccessDenied error must propagate — never
 * fall back to a default password.
 */
describe('readDemoPassword', () => {
  type SendMock = Mock<(command: unknown) => Promise<unknown>>;

  function mockSend(): SendMock {
    return vi.spyOn(SSMClient.prototype, 'send') as unknown as SendMock;
  }

  it('returns the decrypted value from GetParameter', async () => {
    const send = mockSend();
    send.mockResolvedValue({ Parameter: { Value: 's3cret-value' } });
    const client = new SSMClient({ region: 'us-east-1' });

    await expect(
      readDemoPassword(client, '/finance-coach-latam/demo-password'),
    ).resolves.toBe('s3cret-value');

    const command = send.mock.calls[0]?.[0] as GetParameterCommand | undefined;
    expect(command).toBeInstanceOf(GetParameterCommand);
    expect(command?.input).toEqual({
      Name: '/finance-coach-latam/demo-password',
      WithDecryption: true,
    });
  });

  it('throws when the parameter is missing (no Parameter in the response)', async () => {
    mockSend().mockResolvedValue({});
    const client = new SSMClient({ region: 'us-east-1' });

    await expect(
      readDemoPassword(client, '/finance-coach-latam/demo-password'),
    ).rejects.toThrow(/returned no value/);
  });

  it('throws when the parameter value is empty (fail closed, no fallback)', async () => {
    mockSend().mockResolvedValue({ Parameter: { Value: '' } });
    const client = new SSMClient({ region: 'us-east-1' });

    await expect(
      readDemoPassword(client, '/finance-coach-latam/demo-password'),
    ).rejects.toThrow(/returned no value/);
  });

  it('propagates AccessDenied instead of swallowing it (fail closed)', async () => {
    const accessDenied = Object.assign(new Error('AccessDeniedException'), {
      name: 'AccessDeniedException',
    });
    mockSend().mockRejectedValue(accessDenied);
    const client = new SSMClient({ region: 'us-east-1' });

    await expect(
      readDemoPassword(client, '/finance-coach-latam/demo-password'),
    ).rejects.toThrow('AccessDeniedException');
  });
});
