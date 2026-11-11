import type { EditorDocument } from '../core/Document.js';
import { createPosition, type DocumentPosition } from '../core/DocumentPosition.js';

import { createSelection, type Selection, type SelectionDirection } from './Selection.js';

export type SelectionMapper = (position: DocumentPosition) => DocumentPosition;

export class SelectionManager {
  private current: Selection | null = null;

  constructor(private readonly document: EditorDocument) {}

  get(): Selection | null {
    if (!this.current) {
      return null;
    }

    return createSelection(this.current.anchor, this.current.focus);
  }

  set(anchor: DocumentPosition, focus: DocumentPosition = anchor): void {
    this.assertValid(anchor);
    this.assertValid(focus);

    this.current = createSelection(anchor, focus);
  }

  setSelection(selection: Selection): void {
    if (!selection || typeof selection !== 'object') {
      throw new TypeError('Invalid selection.');
    }

    this.set(selection.anchor, selection.focus);
  }

  clear(): void {
    this.current = null;
  }

  hasSelection(): boolean {
    return this.current !== null;
  }

  isCollapsed(): boolean {
    if (!this.current) {
      return false;
    }

    return this.comparePositions(this.current.anchor, this.current.focus) === 0;
  }

  getDirection(): SelectionDirection {
    if (!this.current || this.isCollapsed()) {
      return 'none';
    }

    return this.comparePositions(this.current.anchor, this.current.focus) < 0
      ? 'forward'
      : 'backward';
  }

  getRange(): Range | null {
    if (!this.current) {
      return null;
    }

    const { anchor, focus } = this.current;

    const start = this.comparePositions(anchor, focus) <= 0 ? anchor : focus;

    const end = start === anchor ? focus : anchor;

    const root = this.document.getRoot();

    const ownerDocument = root.nodeType === 9 ? (root as unknown as Document) : root.ownerDocument;

    if (!ownerDocument) {
      throw new Error('Unable to resolve the document owning the editor root.');
    }

    const range = ownerDocument.createRange();

    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    return range;
  }

  reconcile(mapper: SelectionMapper): void {
    if (typeof mapper !== 'function') {
      throw new TypeError('Selection mapper must be a function.');
    }

    if (!this.current) {
      return;
    }

    // Prepare both mapped positions before changing state.
    const anchor = mapper(createPosition(this.current.anchor.node, this.current.anchor.offset));

    const focus = mapper(createPosition(this.current.focus.node, this.current.focus.offset));

    this.assertValid(anchor);
    this.assertValid(focus);

    // Commit only after both positions are valid.
    this.current = createSelection(anchor, focus);
  }

  private assertValid(position: DocumentPosition): void {
    if (!position || !this.document.validatePosition(position)) {
      throw new RangeError('Selection position is outside the editor document or invalid.');
    }

    createPosition(position.node, position.offset);
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
}
