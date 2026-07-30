export interface QueueMessage {
  readonly body: Record<string, unknown>;
  readonly groupId?: string;
}

export interface QueuePublisherPort {
  publish(queueUrl: string, message: QueueMessage): Promise<void>;
}