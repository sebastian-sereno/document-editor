import type { EditorStateContext } from './EditorStateSnapshot.js';

import { captureEditorState, restoreEditorState } from './EditorStateSnapshot.js';
import type { HistoryManager } from './HistoryManager.js';
import type { Transaction } from './Transaction.js';

export class TransactionManager {
  private active: Transaction | null = null;
  private depth = 0;
  private nextId = 1;

  constructor(
    private readonly context: EditorStateContext,
    private readonly history: HistoryManager,
  ) {
    this.history.setTransactionGuard(() => this.hasActiveTransaction());
  }

  begin(): Transaction {
    if (this.active) {
      this.depth++;
      return this.active;
    }

    this.active = {
      before: captureEditorState(this.context),
      id: this.nextId++,
      status: 'active',
    };

    this.depth = 1;

    return this.active;
  }

  commit(): void {
    const transaction = this.requireActive();

    if (this.depth > 1) {
      this.depth--;
      return;
    }

    try {
      const after = captureEditorState(this.context);

      this.history.record(transaction.before, after);

      transaction.status = 'committed';
      this.active = null;
      this.depth = 0;
    } catch (error) {
      this.rollbackActive();
      throw error;
    }
  }

  rollback(): void {
    this.requireActive();
    this.rollbackActive();
  }

  private rollbackActive(): void {
    const transaction = this.requireActive();

    try {
      restoreEditorState(this.context, transaction.before);

      transaction.status = 'rolled-back';
      this.active = null;
      this.depth = 0;
    } catch (error) {
      // Retain the active transaction if restoration fails.
      // This allows recovery rather than falsely reporting success.
      throw error;
    }
  }

  private requireActive(): Transaction {
    if (!this.active) {
      throw new Error('No active transaction.');
    }

    return this.active;
  }

  hasActiveTransaction(): boolean {
    return this.active !== null;
  }

  getDepth(): number {
    return this.depth;
  }

  getActiveTransaction(): Transaction | null {
    return this.active;
  }
}
