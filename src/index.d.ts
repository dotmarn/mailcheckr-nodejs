export type VerificationState = 'queued' | 'processing' | 'retry_scheduled' | 'completed' | 'failed' | (string & {});
export type VerificationStatus = 'deliverable' | 'undeliverable' | 'risky' | 'unknown' | (string & {});

export interface VerificationData {
  id: string;
  email?: string;
  state: VerificationState;
  status?: VerificationStatus | null;
  reason?: string | null;
  checks?: Array<{ check: string; status: string; reason?: string | null; metadata?: unknown }>;
  attempts?: number;
  created_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

export class VerificationResult {
  constructor(data: VerificationData);
  readonly data: VerificationData;
  id(): string;
  state(): VerificationState;
  status(): VerificationStatus | null;
  isCompleted(): boolean;
  isPending(): boolean;
  isFailed(): boolean;
  isDeliverable(): boolean;
  isUndeliverable(): boolean;
  isRisky(): boolean;
  isUnknown(): boolean;
  toJSON(): VerificationData;
}

export class MailCheckrError extends Error {
  constructor(status: number, response: Record<string, unknown>);
  readonly status: number;
  readonly response: Record<string, unknown>;
}

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}

export class MailCheckrClient {
  constructor(options?: ClientOptions);
  verify(email: string, idempotencyKey: string): Promise<VerificationResult>;
  find(id: string): Promise<VerificationResult>;
}

export class WebhookVerifier {
  constructor(secret?: string, options?: { tolerance?: number });
  verifyPayload(body: string | Buffer, timestamp?: string | null, signature?: string | null): boolean;
  verify(body: string | Buffer, headers: Headers | Record<string, string | undefined>): boolean;
}
