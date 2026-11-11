import { describe, expect, it, vi } from 'vitest';
import { CaretManager } from '../../../src/editor/caret/CaretManager.js';
import { EditorDocument } from '../../../src/editor/core/Document.js';
import { CursorManager } from '../../../src/editor/cursors/CursorManager.js';

import {
  captureEditorState,
  restoreEditorState,
} from '../../../src/editor/transactions/EditorStateSnapshot.js';

function createEditorContext() {
  const root = document.createElement('div');
  root.innerHTML = '<p>Hello</p>';

  const doc = new EditorDocument(root);
  const caret = new CaretManager(doc);
  const cursors = new CursorManager(doc);

  const text = root.querySelector('p')!.firstChild!;

  caret.set({
    node: text,
    offset: 2,
  });

  return {
    caret,
    context: {
      caret,
      cursors,
      document: doc,
    },
    cursors,
    doc,
    root,
  };
}

describe('EditorStateSnapshot', () => {
  it('restores document and caret', () => {
    const editor = createEditorContext();

    const snapshot = captureEditorState(editor.context);

    editor.root.innerHTML = '<p>Changed</p>';

    restoreEditorState(editor.context, snapshot);

    expect(editor.root.innerHTML).toBe('<p>Hello</p>');
    expect(editor.caret.get()?.offset).toBe(2);
    expect(editor.caret.get()?.node.textContent).toBe('Hello');
  });

  it('restores cursor positions', () => {
    const editor = createEditorContext();

    const text = editor.root.querySelector('p')!.firstChild!;

    editor.cursors.add({
      node: text,
      offset: 3,
    });

    const snapshot = captureEditorState(editor.context);

    editor.root.innerHTML = '<p>Changed</p>';

    restoreEditorState(editor.context, snapshot);

    const restored = editor.cursors.getAll();

    expect(restored).toHaveLength(1);
    expect(restored[0].position.offset).toBe(3);
    expect(restored[0].position.node.textContent).toBe('Hello');
  });

  it('clears caret when snapshot has no caret', () => {
    const editor = createEditorContext();

    editor.caret.clear();

    const snapshot = captureEditorState(editor.context);

    const text = editor.root.querySelector('p')!.firstChild!;

    editor.caret.set({
      node: text,
      offset: 1,
    });

    restoreEditorState(editor.context, snapshot);

    expect(editor.caret.get()).toBeNull();
  });

  it('rejects invalid cursor paths without changing live DOM', () => {
    const editor = createEditorContext();

    const snapshot = captureEditorState(editor.context);

    const invalidSnapshot = {
      ...snapshot,
      cursors: [
        {
          id: 'invalid',
          position: {
            offset: 0,
            path: [99, 99],
          },
        },
      ],
    };

    const originalHTML = editor.root.innerHTML;
    const originalCaret = editor.caret.get();

    expect(() => restoreEditorState(editor.context, invalidSnapshot)).toThrow();

    expect(editor.root.innerHTML).toBe(originalHTML);
    expect(editor.caret.get()).toStrictEqual(originalCaret);
  });

  it('rejects duplicate cursor IDs before DOM replacement', () => {
    const editor = createEditorContext();

    const text = editor.root.querySelector('p')!.firstChild!;

    editor.cursors.add({ node: text, offset: 1 });
    editor.cursors.add({ node: text, offset: 2 });

    const snapshot = captureEditorState(editor.context);

    const duplicateSnapshot = {
      ...snapshot,
      cursors: [
        snapshot.cursors[0],
        {
          ...snapshot.cursors[1],
          id: snapshot.cursors[0].id,
        },
      ],
    };

    const originalHTML = editor.root.innerHTML;

    expect(() => restoreEditorState(editor.context, duplicateSnapshot)).toThrow(
      'Duplicate cursor IDs',
    );

    expect(editor.root.innerHTML).toBe(originalHTML);
  });
});
