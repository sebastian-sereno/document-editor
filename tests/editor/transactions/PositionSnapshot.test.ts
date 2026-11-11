import { describe, expect, it } from 'vitest';

import {
  capturePosition,
  resolvePositionNode,
  restorePosition,
} from '../../../src/editor/transactions/PositionSnapshot.js';

describe('PositionSnapshot', () => {
  it('captures a text node position', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p>';

    const text = root.querySelector('p')!.firstChild!;

    const snapshot = capturePosition(root, {
      node: text,
      offset: 3,
    });

    expect(snapshot.path).toEqual([0, 0]);
    expect(snapshot.offset).toBe(3);
  });

  it('restores a position against a cloned DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p>';

    const text = root.querySelector('p')!.firstChild!;

    const snapshot = capturePosition(root, {
      node: text,
      offset: 4,
    });

    root.replaceChildren(...Array.from(root.cloneNode(true).childNodes));

    const restored = restorePosition(root, snapshot);

    expect(restored.node.textContent).toBe('Hello');
    expect(restored.offset).toBe(4);
    expect(restored.node).not.toBe(text);
  });

  it('rejects positions outside the root', () => {
    const root = document.createElement('div');
    const outside = document.createTextNode('outside');

    expect(() =>
      capturePosition(root, {
        node: outside,
        offset: 0,
      }),
    ).toThrow();
  });

  it('rejects invalid offsets', () => {
    const root = document.createElement('div');
    root.textContent = 'Hello';

    expect(() =>
      restorePosition(root, {
        offset: 20,
        path: [0],
      }),
    ).toThrow();
  });

  it('restores element child boundaries', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p></p><p></p>';

    const snapshot = capturePosition(root, {
      node: root,
      offset: 1,
    });

    const restored = restorePosition(root, snapshot);

    expect(restored.node).toBe(root);
    expect(restored.offset).toBe(1);
  });

  it('captures and restores comment-node positions', () => {
    const root = document.createElement('div');
    const comment = document.createComment('Hello');

    root.appendChild(comment);

    const snapshot = capturePosition(root, {
      node: comment,
      offset: 3,
    });

    const restored = restorePosition(root, snapshot);

    expect(restored.node.nodeType).toBe(Node.COMMENT_NODE);
    expect(restored.offset).toBe(3);
  });

  it('rejects positions outside the supplied root', () => {
    const root = document.createElement('div');
    const external = document.createTextNode('External');

    expect(() =>
      capturePosition(root, {
        node: external,
        offset: 0,
      }),
    ).toThrow('outside the document root');
  });

  it('rejects invalid position paths', () => {
    const root = document.createElement('div');
    expect(() => resolvePositionNode(root, [-1])).toThrow('Invalid position path');
  });

  it('rejects offsets exceeding comment length', () => {
    const root = document.createElement('div');
    const comment = document.createComment('Hello');

    root.appendChild(comment);
    expect(() => restorePosition(root, { offset: 10, path: [0] })).toThrow();
  });
});
