import type { DocumentPosition } from '../core/DocumentPosition.js';

export interface Selection {
  readonly anchor: DocumentPosition;
  readonly focus: DocumentPosition;
}

export type SelectionDirection = 'forward' | 'backward' | 'none';

export function createSelection(anchor: DocumentPosition, focus: DocumentPosition): Selection {
  return Object.freeze({
    anchor: Object.freeze({
      node: anchor.node,
      offset: anchor.offset,
    }),
    focus: Object.freeze({
      node: focus.node,
      offset: focus.offset,
    }),
  });
}
