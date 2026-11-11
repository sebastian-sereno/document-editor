import type { DocumentPosition } from '../core/DocumentPosition.js';

export interface OperationModification {
  readonly from: DocumentPosition;
  readonly to: DocumentPosition;

  execute(): void;

  /**
   * Maps existing logical positions after this modification.
   * Required when execution invalidates or relocates positions.
   */
  mapPosition?(position: DocumentPosition): DocumentPosition;
}

export interface OperationContext {
  readonly id: string;
}

export interface Operation {
  readonly type: string;

  getModifications(): readonly OperationModification[];

  validate?(context: OperationContext): boolean;

  beforeExecute?(context: OperationContext): void;

  afterExecute?(context: OperationContext): void;

  validateResult?(context: OperationContext): boolean;
}
