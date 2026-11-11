import type { DocumentPosition } from '../core/DocumentPosition.js';

export interface Cursor {
  readonly id: string;
  readonly position: DocumentPosition;
}

export interface CursorSnapshot {
  readonly cursors: readonly Cursor[];
}

export type PositionMapper = (position: DocumentPosition) => DocumentPosition;
