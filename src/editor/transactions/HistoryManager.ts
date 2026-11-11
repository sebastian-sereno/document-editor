import type { EditorStateContext, EditorStateSnapshot } from './EditorStateSnapshot.js';

import { restoreEditorState } from './EditorStateSnapshot.js';

interface HistoryEntry {
  readonly before: EditorStateSnapshot;
  readonly after: EditorStateSnapshot;
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private transactionGuard: () => boolean = () => false;

  constructor(
    private readonly context: EditorStateContext,
    private readonly limit = 100,
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('History limit must be a positive integer.');
    }
  }

  record(before: EditorStateSnapshot, after: EditorStateSnapshot): void {
    this.undoStack.push({ after, before });

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  undo(): boolean {
    this.assertNoActiveTransaction();
    const entry = this.undoStack[this.undoStack.length - 1];

    if (!entry) {
      return false;
    }

    restoreEditorState(this.context, entry.before);

    this.undoStack.pop();
    this.redoStack.push(entry);

    return true;
  }

  redo(): boolean {
    this.assertNoActiveTransaction();
    const entry = this.redoStack[this.redoStack.length - 1];

    if (!entry) {
      return false;
    }

    restoreEditorState(this.context, entry.after);

    this.redoStack.pop();
    this.undoStack.push(entry);

    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  setTransactionGuard(guard: () => boolean): void {
    this.transactionGuard = guard;
  }

  private assertNoActiveTransaction(): void {
    if (this.transactionGuard()) {
      throw new Error('Cannot navigate history during an active transaction.');
    }
  }
}
