import { beforeEach, describe, expect, it } from 'vitest';

import { EditorDocument } from '../../../src/editor/core/Document.js';
import { createPosition } from '../../../src/editor/core/DocumentPosition.js';
import { Cursor } from '../../../src/editor/cursors/Cursor.js';
import { CursorManager } from '../../../src/editor/cursors/CursorManager.js';

describe('CursorManager', () => {
  let root: HTMLElement;
  let textNode: Text;
  let cursors: CursorManager;

  beforeEach(() => {
    root = document.createElement('div');
    root.textContent = 'Hello world';

    textNode = root.firstChild as Text;

    cursors = new CursorManager(new EditorDocument(root));
  });

  it('adds a cursor and returns its ID', () => {
    const id = cursors.add({
      node: textNode,
      offset: 2,
    });

    expect(id).toBeTruthy();
    expect(cursors.getAll()).toHaveLength(1);
    expect(cursors.getAll()[0].position.offset).toBe(2);
  });

  it('assigns unique IDs to cursors', () => {
    const first = cursors.add({
      node: textNode,
      offset: 1,
    });

    const second = cursors.add({
      node: textNode,
      offset: 2,
    });

    expect(first).not.toBe(second);
  });

  it('allows multiple cursors at the same position', () => {
    cursors.add({ node: textNode, offset: 3 });
    cursors.add({ node: textNode, offset: 3 });

    expect(cursors.getAll()).toHaveLength(2);
  });

  it('removes an individual cursor', () => {
    const first = cursors.add({
      node: textNode,
      offset: 2,
    });

    cursors.add({
      node: textNode,
      offset: 5,
    });

    expect(cursors.remove(first)).toBe(true);
    expect(cursors.getAll()).toHaveLength(1);
  });

  it('returns false when removing an unknown cursor', () => {
    expect(cursors.remove('missing')).toBe(false);
  });

  it('clears all additional cursors', () => {
    cursors.add({ node: textNode, offset: 1 });
    cursors.add({ node: textNode, offset: 4 });

    cursors.clear();

    expect(cursors.getAll()).toHaveLength(0);
  });

  it('returns copies of cursor collections', () => {
    cursors.add({ node: textNode, offset: 2 });

    const first = cursors.getAll();
    const second = cursors.getAll();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].position).not.toBe(second[0].position);
  });

  it('replaces all cursors with setAll', () => {
    cursors.add({ node: textNode, offset: 1 });

    cursors.setAll([
      { node: textNode, offset: 3 },
      { node: textNode, offset: 8 },
    ]);

    expect(cursors.getAll()).toHaveLength(2);
    expect(cursors.getAll().map((cursor) => cursor.position.offset)).toEqual([3, 8]);
  });

  it('rejects positions outside the document', () => {
    const external = document.createTextNode('External');

    expect(() => {
      cursors.add({
        node: external,
        offset: 0,
      });
    }).toThrow();
  });

  it('rejects invalid offsets', () => {
    expect(() => {
      cursors.add({
        node: textNode,
        offset: 100,
      });
    }).toThrow();
  });

  it('saves and restores cursor states', () => {
    cursors.add({ node: textNode, offset: 2 });
    cursors.add({ node: textNode, offset: 6 });

    cursors.save('checkpoint');

    cursors.clear();

    cursors.restore('checkpoint');

    expect(cursors.getAll().map((cursor) => cursor.position.offset)).toEqual([2, 6]);
  });

  it('rejects duplicate snapshot identifiers', () => {
    cursors.save('checkpoint');

    expect(() => {
      cursors.save('checkpoint');
    }).toThrow();
  });

  it('supports explicitly overwriting snapshots', () => {
    cursors.add({ node: textNode, offset: 2 });
    cursors.save('checkpoint');

    cursors.clear();
    cursors.add({ node: textNode, offset: 7 });

    cursors.save('checkpoint', true);
    cursors.clear();
    cursors.restore('checkpoint');

    expect(cursors.getAll()[0].position.offset).toBe(7);
  });

  it('rejects restoring unknown snapshots', () => {
    expect(() => {
      cursors.restore('missing');
    }).toThrow();
  });

  it('reconciles cursor positions', () => {
    cursors.add({ node: textNode, offset: 2 });

    cursors.reconcile((position) => ({
      node: position.node,
      offset: position.offset + 1,
    }));

    expect(cursors.getAll()[0].position.offset).toBe(3);
  });

  it('does not retain partially updated state when reconciliation fails', () => {
    cursors.add({ node: textNode, offset: 2 });
    cursors.add({ node: textNode, offset: 4 });

    expect(() => {
      cursors.reconcile((position) => ({
        node: position.node,
        offset: position.offset === 2 ? 3 : 100,
      }));
    }).toThrow();

    expect(cursors.getAll().map((cursor) => cursor.position.offset)).toEqual([2, 4]);
  });

  it('preserves cursor IDs when reconciling', () => {
    const id = cursors.add({
      node: textNode,
      offset: 2,
    });

    cursors.reconcile((position) => ({
      node: position.node,
      offset: position.offset + 1,
    }));

    expect(cursors.getAll()[0].id).toBe(id);
  });

  it('does not partially replace cursors when setAll fails', () => {
    cursors.add({
      node: textNode,
      offset: 2,
    });

    const external = document.createTextNode('External');

    expect(() => {
      cursors.setAll([
        { node: textNode, offset: 4 },
        { node: external, offset: 0 },
      ]);
    }).toThrow();

    expect(cursors.getAll()).toHaveLength(1);
    expect(cursors.getAll()[0].position.offset).toBe(2);
  });

  it('reconciles saved cursor snapshots', () => {
    cursors.add({
      node: textNode,
      offset: 2,
    });

    cursors.save('checkpoint');

    cursors.reconcile((position) => ({
      node: position.node,
      offset: position.offset + 1,
    }));

    cursors.clear();
    cursors.restore('checkpoint');

    expect(cursors.getAll()[0].position.offset).toBe(3);
  });

  it('generates unique IDs after restoring an old snapshot', () => {
    cursors.add({
      node: textNode,
      offset: 2,
    });

    cursors.save('checkpoint');

    cursors.clear();
    cursors.restore('checkpoint');

    const restoredId = cursors.getAll()[0].id;

    const newId = cursors.add({
      node: textNode,
      offset: 5,
    });

    expect(newId).not.toBe(restoredId);
  });

  describe('CursorManager.restoreAll', () => {
    it('preserves cursor IDs', () => {
      const position = createPosition(textNode, 2);

      cursors.restoreAll([
        { id: 'cursor-10', position },
        { id: 'custom-cursor', position },
      ]);

      expect(cursors.getAll().map((c) => c.id)).toEqual(['cursor-10', 'custom-cursor']);
    });

    it('rejects duplicate IDs', () => {
      const position = createPosition(textNode, 2);

      expect(() =>
        cursors.restoreAll([
          { id: 'cursor-1', position },
          { id: 'cursor-1', position },
        ]),
      ).toThrow('Duplicate cursor ID');
    });

    it('rejects invalid positions', () => {
      const outsideNode = document.createTextNode('outside');

      const original = cursors.getAll();

      expect(() =>
        cursors.restoreAll([
          {
            id: 'cursor-20',
            position: {
              node: outsideNode,
              offset: 2,
            },
          },
        ]),
      ).toThrow();

      expect(cursors.getAll()).toEqual(original);
    });

    it('does not partially replace cursors on failure', () => {
      const position = createPosition(textNode, 2);

      cursors.add(position);

      const original = cursors.getAll();

      expect(() =>
        cursors.restoreAll([
          { id: 'cursor-10', position },
          {
            id: 'cursor-11',
            position: {
              node: document.createTextNode('invalid'),
              offset: 0,
            },
          },
        ]),
      ).toThrow();

      expect(cursors.getAll()).toEqual(original);
    });

    it('advances generated IDs after restoration', () => {
      const position = createPosition(textNode, 2);

      cursors.restoreAll([{ id: 'cursor-25', position }]);

      expect(cursors.add(position)).toBe('cursor-26');
    });
  });
});
