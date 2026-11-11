import type { CaretManager } from '../caret/CaretManager.js';
import type { EditorDocument } from '../core/Document.js';
import type { DocumentPosition } from '../core/DocumentPosition.js';
import type { CursorManager } from '../cursors/CursorManager.js';
import type { SelectionManager } from '../selection/SelectionManager.js';

import type { TransactionManager } from '../transactions/TransactionManager.js';

import type { Operation, OperationContext, OperationModification } from './Operation.js';

import type { OperationResult } from './OperationResult.js';

export interface OperationManagerOptions {
  readonly allowNestedTransactions?: boolean;
  readonly caret?: CaretManager;
  readonly cursors?: CursorManager;
  readonly selection?: SelectionManager;
}

interface PreparedModification {
  readonly modification: OperationModification;
  readonly originalIndex: number;
  readonly start: DocumentPosition;
  readonly end: DocumentPosition;
}

export class OperationManager {
  private nextId = 1;

  constructor(
    private readonly document: EditorDocument,
    private readonly transactions: TransactionManager,
    private readonly options: OperationManagerOptions = {},
  ) {}

  execute(operation: Operation): OperationResult {
    const startedAt = Date.now();
    const id = `operation-${this.nextId++}`;

    let transactionStarted = false;
    let modificationsExecuted = 0;

    let status: OperationResult['status'] = 'failed';
    let error: Error | undefined;

    const context: OperationContext = { id };

    try {
      // 1. Validate operation structure.
      this.assertValidOperation(operation);

      // 2. Reject prohibited nested operations.
      if (
        this.transactions.hasActiveTransaction() &&
        this.options.allowNestedTransactions === false
      ) {
        throw new Error('Executing operations inside an active transaction is disabled.');
      }

      // 3. Validate and prepare before opening a transaction.
      if (operation.validate && !operation.validate(context)) {
        throw new Error('Operation validation failed.');
      }

      const modifications = this.sortModifications(
        this.prepareModifications(operation.getModifications()),
      );

      this.assertNoOverlaps(modifications);

      // 4. Begin or join transaction.
      this.transactions.begin();
      transactionStarted = true;

      operation.beforeExecute?.(context);

      // 5. Execute descending modifications.
      for (const item of modifications) {
        this.assertValidPosition(item.start);
        this.assertValidPosition(item.end);

        item.modification.execute();

        modificationsExecuted++;

        // 6. Reconcile logical positions.
        const mapper = item.modification.mapPosition ?? ((position: DocumentPosition) => position);

        this.options.caret?.reconcile(mapper);
        this.options.cursors?.reconcile(mapper);
        this.options.selection?.reconcile(mapper);
      }

      operation.afterExecute?.(context);

      // 7. Validate final result.
      if (operation.validateResult && !operation.validateResult(context)) {
        throw new Error('Operation result validation failed.');
      }

      // 8. Commit.
      this.transactions.commit();
      status = 'success';
    } catch (cause) {
      error = this.toError(cause);

      if (transactionStarted && this.transactions.hasActiveTransaction()) {
        try {
          this.transactions.rollback();
          status = 'rolled-back';
        } catch (rollbackCause) {
          error = new Error(
            `Operation failed: ${error.message}. ` +
              `Rollback failed: ${this.toError(rollbackCause).message}`,
          );

          status = 'failed';
        }
      } else {
        status = 'failed';
      }
    }

    const completedAt = Date.now();

    return {
      completedAt,
      duration: completedAt - startedAt,
      error,
      id,
      modificationsExecuted,
      startedAt,
      status,
      type: typeof operation?.type === 'string' ? operation.type : 'unknown',
    };
  }

  private assertValidOperation(operation: Operation): void {
    if (!operation || typeof operation !== 'object') {
      throw new TypeError('Invalid operation.');
    }

    if (typeof operation.type !== 'string' || operation.type.trim().length === 0) {
      throw new TypeError('Operation type must be a non-empty string.');
    }

    if (typeof operation.getModifications !== 'function') {
      throw new TypeError('Operation must implement getModifications().');
    }
  }

  private prepareModifications(
    modifications: readonly OperationModification[],
  ): PreparedModification[] {
    if (!Array.isArray(modifications)) {
      throw new TypeError('Operation modifications must be an array.');
    }

    const prepared = modifications.map((modification, originalIndex) => {
      if (!modification || typeof modification.execute !== 'function') {
        throw new TypeError('Invalid operation modification.');
      }

      this.assertValidPosition(modification.from);
      this.assertValidPosition(modification.to);

      const comparison = this.comparePositions(modification.from, modification.to);

      if (comparison > 0) {
        throw new RangeError('Modification start cannot be after its end.');
      }

      return {
        end: modification.to,
        modification,
        originalIndex,
        start: modification.from,
      };
    });

    return prepared;
  }

  private assertValidPosition(position: DocumentPosition): void {
    if (!this.document.validatePosition(position)) {
      throw new RangeError('Operation position is outside the editor document or invalid.');
    }
  }

  private comparePositions(left: DocumentPosition, right: DocumentPosition): number {
    const root = this.document.getRoot();

    const ownerDocument = root.nodeType === 9 ? (root as unknown as Document) : root.ownerDocument;

    if (!ownerDocument) {
      throw new Error('Unable to resolve the document owning the editor root.');
    }

    const leftRange = ownerDocument.createRange();
    const rightRange = ownerDocument.createRange();

    leftRange.setStart(left.node, left.offset);
    leftRange.collapse(true);

    rightRange.setStart(right.node, right.offset);
    rightRange.collapse(true);

    return leftRange.compareBoundaryPoints(0, rightRange);
  }

  private rangesOverlap(first: PreparedModification, second: PreparedModification): boolean {
    const firstZeroWidth = this.comparePositions(first.start, first.end) === 0;

    const secondZeroWidth = this.comparePositions(second.start, second.end) === 0;

    const startsEqual = this.comparePositions(first.start, second.start) === 0;

    // Two insertions at exactly the same position conflict.
    if (firstZeroWidth && secondZeroWidth && startsEqual) {
      return true;
    }

    const firstEndsBeforeSecond = this.comparePositions(first.end, second.start) <= 0;

    const secondEndsBeforeFirst = this.comparePositions(second.end, first.start) <= 0;

    // A zero-width insertion strictly inside a replacement
    // is considered an overlap.
    if (firstZeroWidth || secondZeroWidth) {
      const firstPointInsideSecond =
        firstZeroWidth &&
        this.comparePositions(first.start, second.start) > 0 &&
        this.comparePositions(first.start, second.end) < 0;

      const secondPointInsideFirst =
        secondZeroWidth &&
        this.comparePositions(second.start, first.start) > 0 &&
        this.comparePositions(second.start, first.end) < 0;

      return firstPointInsideSecond || secondPointInsideFirst;
    }

    return !firstEndsBeforeSecond && !secondEndsBeforeFirst;
  }

  private assertNoOverlaps(modifications: readonly PreparedModification[]): void {
    for (let i = 0; i < modifications.length; i++) {
      for (let j = i + 1; j < modifications.length; j++) {
        if (this.rangesOverlap(modifications[i]!, modifications[j]!)) {
          throw new Error('Overlapping operation modifications detected.');
        }
      }
    }
  }

  private toError(cause: unknown): Error {
    if (cause instanceof Error) {
      return cause;
    }

    return new Error(String(cause));
  }

  private sortModifications(modifications: PreparedModification[]): PreparedModification[] {
    return [...modifications].sort((a, b) => {
      const startOrder = this.comparePositions(b.start, a.start);
      if (startOrder !== 0) return startOrder;

      const endOrder = this.comparePositions(b.end, a.end);
      return endOrder !== 0 ? endOrder : a.originalIndex - b.originalIndex;
    });
  }
}
