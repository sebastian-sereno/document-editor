import { beforeEach, describe, expect, it } from 'vitest';
import { CaretManager } from '../../../src/editor/caret/CaretManager.js';
import { EditorDocument } from '../../../src/editor/core/Document.js';

describe('CaretManager', () => {
  let root: HTMLElement;
  let documentModel: EditorDocument;
  let caret: CaretManager;
  let textNode: Text;

  beforeEach(() => {
    root = document.createElement('div');
    root.textContent = 'Hello world';

    textNode = root.firstChild as Text;

    documentModel = new EditorDocument(root);
    caret = new CaretManager(documentModel);
  });

  it('should initialize at the beginning of the document', () => {
    expect(caret.get()).toEqual({
      node: root,
      offset: 0,
    });
  });

  it('should set and retrieve the caret position', () => {
    caret.set({
      node: textNode,
      offset: 5,
    });

    expect(caret.get()).toEqual({
      node: textNode,
      offset: 5,
    });
  });

  it('should save a caret position using an identifier', () => {
    caret.set({
      node: textNode,
      offset: 5,
    });

    caret.save('position-1');

    caret.set({
      node: textNode,
      offset: 10,
    });

    caret.restore('position-1');

    expect(caret.get()).toEqual({
      node: textNode,
      offset: 5,
    });
  });

  it('should reject positions outside the document', () => {
    const externalNode = document.createTextNode('External');

    expect(() => {
      caret.set({
        node: externalNode,
        offset: 0,
      });
    }).toThrow();
  });

  it('should reject invalid offsets', () => {
    expect(() => {
      caret.set({
        node: textNode,
        offset: 100,
      });
    }).toThrow();
  });

  it('should reject duplicate saved identifiers', () => {
    caret.save('position-1');

    expect(() => {
      caret.save('position-1');
    }).toThrow();
  });

  it('should reject restoring an unknown identifier', () => {
    expect(() => {
      caret.restore('missing');
    }).toThrow();
  });

  it('should allow overwriting a saved position explicitly', () => {
    caret.set({
      node: textNode,
      offset: 2,
    });

    caret.save('position-1');

    caret.set({
      node: textNode,
      offset: 8,
    });

    caret.save('position-1', true);
    caret.restore('position-1');

    expect(caret.get()!.offset).toBe(8);
  });

  it('should return copies of position objects', () => {
    const first = caret.get();
    const second = caret.get();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
