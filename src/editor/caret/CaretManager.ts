import type { EditorDocument } from '../core/Document.js';
import type { DocumentPosition } from '../core/DocumentPosition.js';
import { createPosition } from '../core/DocumentPosition.js';

export class CaretManager {
  private current: DocumentPosition | null;

  private readonly saved = new Map<string, DocumentPosition>();

  constructor(private readonly document: EditorDocument) {
    this.current = createPosition(document.getRoot(), 0);
  }

  get(): DocumentPosition | null {
    if (!this.current) return null;
    const { node, offset } = this.current;
    return { node, offset };
  }

  set(position: DocumentPosition): void {
    this.assertValid(position);

    this.current = createPosition(position.node, position.offset);
  }

  save(id: string, overwrite = false): void {
    this.validateId(id);

    if (this.saved.has(id) && !overwrite) {
      throw new Error(`Caret position "${id}" already exists.`);
    }

    this.assertValid(this.current);
    const { node, offset } = this.current!;
    this.saved.set(id, { node, offset });
  }

  restore(id: string): void {
    this.validateId(id);

    const position = this.saved.get(id);

    if (!position) {
      throw new Error(`Caret position "${id}" does not exist.`);
    }

    this.assertValid(position);

    this.current = createPosition(position.node, position.offset);
  }

  reconcile(mapper: (position: DocumentPosition) => DocumentPosition): void {
    if (typeof mapper !== 'function') {
      throw new TypeError('Position mapper must be a function.');
    }

    const current = this.current
      ? mapper(createPosition(this.current.node, this.current.offset))
      : null;

    const saved = new Map<string, DocumentPosition>();

    for (const [id, position] of this.saved) {
      const mapped = mapper(createPosition(position.node, position.offset));
      this.assertValid(mapped);

      saved.set(id, createPosition(mapped.node, mapped.offset));
    }

    if (current) {
      this.assertValid(current);
    }

    this.current = current ? createPosition(current.node, current.offset) : null;

    this.saved.clear();

    for (const [id, position] of saved) {
      this.saved.set(id, position);
    }
  }

  clear() {
    this.current = null;
  }

  hasSaved(id: string): boolean {
    return this.saved.has(id);
  }

  removeSaved(id: string): boolean {
    return this.saved.delete(id);
  }

  clearSaved(): void {
    this.saved.clear();
  }

  private assertValid(position: DocumentPosition | null): void {
    if (position == null || !this.document.validatePosition(position)) {
      throw new RangeError('Caret position is outside the editor document or invalid.');
    }
  }

  private validateId(id: string): void {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new TypeError('Caret identifier must be a non-empty string.');
    }
  }
}
