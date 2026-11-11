import type { EditorDocument } from '../core/Document.js';
import { createPosition, type DocumentPosition } from '../core/DocumentPosition.js';

import type { Cursor, CursorSnapshot, PositionMapper } from './Cursor.js';

export class CursorManager {
  private cursors: Cursor[] = [];

  private readonly snapshots = new Map<string, CursorSnapshot>();

  private nextId = 1;

  constructor(private readonly document: EditorDocument) {}

  add(position: DocumentPosition): string {
    this.assertValid(position);

    const id = this.generateId();

    this.cursors.push({
      id,
      position: this.copyPosition(position),
    });

    return id;
  }

  remove(id: string): boolean {
    const index = this.cursors.findIndex((cursor) => cursor.id === id);

    if (index === -1) {
      return false;
    }

    this.cursors.splice(index, 1);

    return true;
  }

  clear(): void {
    this.cursors = [];
  }

  getAll(): Cursor[] {
    return this.cursors.map((cursor) => ({
      id: cursor.id,
      position: this.copyPosition(cursor.position),
    }));
  }

  setAll(positions: readonly DocumentPosition[]): void {
    if (!Array.isArray(positions)) {
      throw new TypeError('Cursor positions must be an array.');
    }

    // Validate every position before changing state.
    const validated = positions.map((position) => {
      this.assertValid(position);
      return this.copyPosition(position);
    });

    const replacement = validated.map((position) => ({
      id: this.generateId(),
      position,
    }));

    this.cursors = replacement;
  }

  save(id: string, overwrite = false): void {
    this.validateId(id);

    if (this.snapshots.has(id) && !overwrite) {
      throw new Error(`Cursor snapshot "${id}" already exists.`);
    }

    this.snapshots.set(id, {
      cursors: this.getAll(),
    });
  }

  restore(id: string): void {
    this.validateId(id);

    const snapshot = this.snapshots.get(id);

    if (!snapshot) {
      throw new Error(`Cursor snapshot "${id}" does not exist.`);
    }

    // Validate everything before restoring.
    const restored = snapshot.cursors.map((cursor) => {
      this.assertValid(cursor.position);

      return {
        id: cursor.id,
        position: this.copyPosition(cursor.position),
      };
    });

    this.cursors = restored;
  }

  restoreAll(cursors: readonly Cursor[]): void {
    if (!Array.isArray(cursors)) {
      throw new TypeError('Cursors must be an array.');
    }

    // Validate and prepare the complete replacement first.
    const ids = new Set<string>();
    let highestGeneratedId = this.nextId - 1;

    const restored = cursors.map((cursor) => {
      if (!cursor || typeof cursor.id !== 'string' || cursor.id.trim().length === 0) {
        throw new TypeError('Invalid cursor ID.');
      }

      if (ids.has(cursor.id)) {
        throw new Error(`Duplicate cursor ID "${cursor.id}".`);
      }

      ids.add(cursor.id);

      this.assertValid(cursor.position);

      const match = /^cursor-(\d+)$/.exec(cursor.id);

      if (match) {
        const numericId = Number(match[1]);

        if (Number.isSafeInteger(numericId)) {
          highestGeneratedId = Math.max(highestGeneratedId, numericId);
        }
      }

      return {
        id: cursor.id,
        position: this.copyPosition(cursor.position),
      };
    });

    // Commit only after every cursor has passed validation.
    this.cursors = restored;
    this.nextId = highestGeneratedId + 1;
  }

  hasSaved(id: string): boolean {
    return this.snapshots.has(id);
  }

  removeSaved(id: string): boolean {
    return this.snapshots.delete(id);
  }

  clearSaved(): void {
    this.snapshots.clear();
  }

  reconcile(mapper: PositionMapper): void {
    if (typeof mapper !== 'function') {
      throw new TypeError('Position mapper must be a function.');
    }

    // Prepare all active cursor changes first.
    const updatedCursors = this.cursors.map((cursor) => ({
      id: cursor.id,
      position: this.mapPosition(cursor.position, mapper),
    }));

    // Saved locations must also follow document changes.
    const updatedSnapshots = new Map<string, CursorSnapshot>();

    for (const [id, snapshot] of this.snapshots) {
      const cursors = snapshot.cursors.map((cursor) => ({
        id: cursor.id,
        position: this.mapPosition(cursor.position, mapper),
      }));

      updatedSnapshots.set(id, { cursors });
    }

    // Apply only after all mappings have succeeded.
    this.cursors = updatedCursors;

    this.snapshots.clear();

    for (const [id, snapshot] of updatedSnapshots) {
      this.snapshots.set(id, snapshot);
    }
  }

  private mapPosition(position: DocumentPosition, mapper: PositionMapper): DocumentPosition {
    const mapped = mapper(this.copyPosition(position));

    this.assertValid(mapped);

    return this.copyPosition(mapped);
  }

  private assertValid(position: DocumentPosition): void {
    if (!position || !this.document.validatePosition(position)) {
      throw new RangeError('Cursor position is outside the editor document or invalid.');
    }

    createPosition(position.node, position.offset);
  }

  private copyPosition(position: DocumentPosition): DocumentPosition {
    return {
      node: position.node,
      offset: position.offset,
    };
  }

  private generateId(): string {
    return `cursor-${this.nextId++}`;
  }

  private validateId(id: string): void {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new TypeError('Snapshot identifier must be a non-empty string.');
    }
  }
}
