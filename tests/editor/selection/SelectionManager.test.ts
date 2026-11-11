import { beforeEach, describe, expect, it } from 'vitest';

import { EditorDocument } from '../../../src/editor/core/Document.js';
import { createPosition } from '../../../src/editor/core/DocumentPosition.js';
import { SelectionManager } from '../../../src/editor/selection/SelectionManager.js';

describe('SelectionManager', () => {
  let root: HTMLElement;
  let textNode: Text;
  let manager: SelectionManager;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = '<p>Hello world</p>';

    textNode = root.querySelector('p')!.firstChild as Text;

    manager = new SelectionManager(new EditorDocument(root));
  });

  it('starts without a selection', () => {
    expect(manager.get()).toBeNull();
    expect(manager.hasSelection()).toBe(false);
    expect(manager.getRange()).toBeNull();
    expect(manager.isCollapsed()).toBe(false);
    expect(manager.getDirection()).toBe('none');
  });

  it('sets and retrieves a selection', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    expect(manager.get()).toEqual({
      anchor: { node: textNode, offset: 1 },
      focus: { node: textNode, offset: 5 },
    });

    expect(manager.hasSelection()).toBe(true);
  });

  it('creates a collapsed selection', () => {
    manager.set(createPosition(textNode, 3));

    expect(manager.isCollapsed()).toBe(true);
    expect(manager.getDirection()).toBe('none');
  });

  it('identifies forward selections', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    expect(manager.getDirection()).toBe('forward');
  });

  it('identifies backward selections', () => {
    manager.set(createPosition(textNode, 5), createPosition(textNode, 1));

    expect(manager.getDirection()).toBe('backward');
  });

  it('returns an ordered DOM range for forward selections', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    const range = manager.getRange();

    expect(range).not.toBeNull();
    expect(range!.startOffset).toBe(1);
    expect(range!.endOffset).toBe(5);
    expect(range!.toString()).toBe('ello');
  });

  it('returns an ordered DOM range for backward selections', () => {
    manager.set(createPosition(textNode, 5), createPosition(textNode, 1));

    const range = manager.getRange();

    expect(range!.startOffset).toBe(1);
    expect(range!.endOffset).toBe(5);
    expect(range!.toString()).toBe('ello');

    expect(manager.getDirection()).toBe('backward');
  });

  it('returns copies of selection objects', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    const first = manager.get();
    const second = manager.get();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first!.anchor).not.toBe(second!.anchor);
  });

  it('rejects positions outside the document', () => {
    const external = document.createTextNode('External');

    expect(() => {
      manager.set(createPosition(textNode, 1), createPosition(external, 2));
    }).toThrow();

    expect(manager.hasSelection()).toBe(false);
  });

  it('rejects invalid offsets', () => {
    expect(() => {
      manager.set({ node: textNode, offset: 100 });
    }).toThrow();
  });

  it('does not replace an existing selection when setting fails', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    const original = manager.get();

    expect(() => {
      manager.set(createPosition(textNode, 2), createPosition(textNode, 100));
    }).toThrow();

    expect(manager.get()).toEqual(original);
  });

  it('supports setting an existing selection', () => {
    manager.setSelection({
      anchor: createPosition(textNode, 2),
      focus: createPosition(textNode, 8),
    });

    expect(manager.get()?.anchor.offset).toBe(2);
    expect(manager.get()?.focus.offset).toBe(8);
  });

  it('clears the selection', () => {
    manager.set(createPosition(textNode, 1), createPosition(textNode, 5));

    manager.clear();

    expect(manager.get()).toBeNull();
    expect(manager.hasSelection()).toBe(false);
    expect(manager.getRange()).toBeNull();
  });

  it('reconciles both selection endpoints', () => {
    manager.set(createPosition(textNode, 2), createPosition(textNode, 5));

    manager.reconcile((position) => ({
      node: position.node,
      offset: position.offset + 1,
    }));

    expect(manager.get()?.anchor.offset).toBe(3);
    expect(manager.get()?.focus.offset).toBe(6);
  });

  it('preserves backward direction during reconciliation', () => {
    manager.set(createPosition(textNode, 5), createPosition(textNode, 2));

    manager.reconcile((position) => ({
      node: position.node,
      offset: position.offset + 1,
    }));

    expect(manager.getDirection()).toBe('backward');
    expect(manager.get()?.anchor.offset).toBe(6);
    expect(manager.get()?.focus.offset).toBe(3);
  });

  it('does not partially update when reconciliation fails', () => {
    manager.set(createPosition(textNode, 2), createPosition(textNode, 4));

    const original = manager.get();

    expect(() => {
      manager.reconcile((position) => ({
        node: position.node,
        offset: position.offset === 2 ? 3 : 100,
      }));
    }).toThrow();

    expect(manager.get()).toEqual(original);
  });

  it('rejects a non-function mapper', () => {
    expect(() => {
      manager.reconcile(null as never);
    }).toThrow('Selection mapper must be a function.');
  });

  it('keeps an empty selection unchanged during reconciliation', () => {
    manager.reconcile(() => {
      throw new Error('Should not execute.');
    });

    expect(manager.get()).toBeNull();
  });
});
