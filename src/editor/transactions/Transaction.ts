import type { EditorStateSnapshot } from './EditorStateSnapshot.js';

export type TransactionStatus = 'active' | 'committed' | 'rolled-back';

export interface Transaction {
  readonly id: number;
  readonly before: EditorStateSnapshot;
  status: TransactionStatus;
}
