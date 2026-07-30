import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type {
  QueueMessage,
  QueuePublisherPort,
} from '../../domain/ports/queue.port';

export interface SQSPublisherConfig {
  readonly region?: string;
}

export class SQSPublisherAdapter implements QueuePublisherPort {
  private readonly client: SQSClient;

  constructor(config: SQSPublisherConfig = {}) {
    const region = config.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.client = new SQSClient({ region });
  }

  async publish(queueUrl: string, message: QueueMessage): Promise<void> {
    if (!queueUrl.trim()) {
      throw new Error('SQSPublisherAdapter.publish: queueUrl is required');
    }
    if (!message.body || typeof message.body !== 'object') {
      throw new Error('SQSPublisherAdapter.publish: message.body is required');
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message.body),
      ...(message.groupId ? { MessageGroupId: message.groupId } : {}),
    });

    try {
      await this.client.send(command);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`SQSPublisherAdapter.publish: ${detail}`);
    }
  }
}