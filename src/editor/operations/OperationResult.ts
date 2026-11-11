export type OperationStatus = 'success' | 'rolled-back' | 'failed';

export interface OperationResult {
  readonly id: string;
  readonly type: string;
  readonly status: OperationStatus;

  readonly modificationsExecuted: number;

  readonly error?: Error | undefined;

  readonly startedAt: number;
  readonly completedAt: number;
  readonly duration: number;
}
