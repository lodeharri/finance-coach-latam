import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SQSPublisherAdapter } from './sqs-publisher.adapter';

const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/categorizer';

interface SendMessageInput {
  readonly QueueUrl?: string;
  readonly MessageBody?: string;
  readonly MessageGroupId?: string;
}

function capturedSend(): SendMessageInput[] {
  const send = vi.mocked(SQSClient.prototype.send);
  return send.mock.calls.map(([command]) => {
    expect(command).toBeInstanceOf(SendMessageCommand);
    return (command as unknown as { input: SendMessageInput }).input;
  });
}

describe('SQSPublisherAdapter', () => {
  let adapter: SQSPublisherAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SQSClient.prototype, 'send').mockResolvedValue({
      MessageId: 'msg-id',
      $metadata: {},
    } as never);
    adapter = new SQSPublisherAdapter({ region: 'us-east-1' });
  });

  it('serializes the body and sends a SendMessageCommand', async () => {
    await adapter.publish(queueUrl, {
      body: { transactionId: 'tx-1', userId: 'user-1' },
    });

    const inputs = capturedSend();
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.QueueUrl).toBe(queueUrl);
    expect(inputs[0]!.MessageBody).toBe(
      JSON.stringify({ transactionId: 'tx-1', userId: 'user-1' }),
    );
    expect(inputs[0]!.MessageGroupId).toBeUndefined();
  });

  it('forwards the FIFO groupId when provided', async () => {
    await adapter.publish(queueUrl, {
      body: { transactionId: 'tx-2' },
      groupId: 'user-42',
    });

    const inputs = capturedSend();
    expect(inputs[0]!.MessageGroupId).toBe('user-42');
  });

  it('rejects when queueUrl is missing', async () => {
    await expect(
      adapter.publish('', { body: { transactionId: 'tx-3' } }),
    ).rejects.toThrow(/queueUrl is required/);
  });

  it('wraps SQS errors with a descriptive message', async () => {
    vi.spyOn(SQSClient.prototype, 'send').mockRejectedValueOnce(
      new Error('AccessDenied'),
    );
    await expect(
      adapter.publish(queueUrl, { body: { transactionId: 'tx-4' } }),
    ).rejects.toThrow(/AccessDenied/);
  });
});