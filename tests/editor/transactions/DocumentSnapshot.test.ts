import { describe, expect, it } from 'vitest';

import {
  captureDocument,
  restoreDocument,
} from '../../../src/editor/transactions/DocumentSnapshot.js';

describe('DocumentSnapshot', () => {
  it('captures document structure', () => {
    const root = document.createElement('div');

    root.innerHTML = '<p class="test"><strong>Hello</strong></p>';

    const snapshot = captureDocument(root);

    root.innerHTML = '<span>Changed</span>';

    restoreDocument(root, snapshot);

    expect(root.innerHTML).toBe('<p class="test"><strong>Hello</strong></p>');
  });

  it('preserves attributes', () => {
    const root = document.createElement('div');

    root.innerHTML = '<p id="original">Text</p>';

    const snapshot = captureDocument(root);

    root.innerHTML = '<p>Changed</p>';

    restoreDocument(root, snapshot);

    expect(root.querySelector('p')?.id).toBe('original');
  });

  it('does not retain live child references', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p>';

    const original = root.firstChild;
    const snapshot = captureDocument(root);

    root.innerHTML = '<p>Changed</p>';

    restoreDocument(root, snapshot);

    expect(root.firstChild).not.toBe(original);
    expect(root.textContent).toBe('Hello');
  });

  it('restores an empty document', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p>';

    const snapshot = captureDocument(root);

    root.replaceChildren();

    restoreDocument(root, snapshot);

    expect(root.innerHTML).toBe('<p>Hello</p>');
  });

  it('preserves comments', () => {
    const root = document.createElement('div');

    root.appendChild(document.createComment('original'));

    const snapshot = captureDocument(root);

    root.replaceChildren();

    restoreDocument(root, snapshot);

    expect(root.firstChild?.nodeType).toBe(Node.COMMENT_NODE);

    expect(root.firstChild?.nodeValue).toBe('original');
  });
});
