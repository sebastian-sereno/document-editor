import { describe, expect, it, vi } from 'vitest';
import type {
  EditorStateContext,
  EditorStateSnapshot,
} from '../../../src/editor/transactions/EditorStateSnapshot.js';
import * as StateSnapshot from '../../../src/editor/transactions/EditorStateSnapshot.js';
import { HistoryManager } from '../../../src/editor/transactions/HistoryManager.js';

function createSnapshot(value: string): EditorStateSnapshot {
  return {
    caret: null,
    cursors: [],
    document: {
      children: [document.createTextNode(value)],
    },
  };
}

function createContext(): EditorStateContext {
  return {
    caret: {} as never,
    cursors: {} as never,
    document: {
      getRoot: () => document.createElement('div'),
    } as never,
  };
}

describe('HistoryManager', () => {
  it('records a history entry', () => {
    const history = new HistoryManager(createContext());

    history.record(createSnapshot('A'), createSnapshot('B'));

    expect(history.canUndo()).toBe(true);
    expect(history.getUndoCount()).toBe(1);
  });

  it('undoes to the previous snapshot', () => {
    const restore = vi.spyOn(StateSnapshot, 'restoreEditorState').mockImplementation(() => {});

    const history = new HistoryManager(createContext());

    const before = createSnapshot('A');
    const after = createSnapshot('B');

    history.record(before, after);

    expect(history.undo()).toBe(true);

    expect(restore).toHaveBeenCalledWith(expect.anything(), before);

    expect(history.canRedo()).toBe(true);

    restore.mockRestore();
  });

  it('redoes to the next snapshot', () => {
    const restore = vi.spyOn(StateSnapshot, 'restoreEditorState').mockImplementation(() => {});

    const history = new HistoryManager(createContext());

    const before = createSnapshot('A');
    const after = createSnapshot('B');

    history.record(before, after);
    history.undo();

    expect(history.redo()).toBe(true);

    expect(restore).toHaveBeenLastCalledWith(expect.anything(), after);

    restore.mockRestore();
  });

  it('clears redo history after a new change', () => {
    const restore = vi.spyOn(StateSnapshot, 'restoreEditorState').mockImplementation(() => {});

    const history = new HistoryManager(createContext());

    history.record(createSnapshot('A'), createSnapshot('B'));

    history.undo();

    history.record(createSnapshot('A'), createSnapshot('C'));

    expect(history.canRedo()).toBe(false);

    restore.mockRestore();
  });

  it('respects the history limit', () => {
    const history = new HistoryManager(createContext(), 2);

    history.record(createSnapshot('A'), createSnapshot('B'));
    history.record(createSnapshot('B'), createSnapshot('C'));
    history.record(createSnapshot('C'), createSnapshot('D'));

    expect(history.getUndoCount()).toBe(2);
  });

  it('returns false when there is nothing to undo', () => {
    const history = new HistoryManager(createContext());

    expect(history.undo()).toBe(false);
  });

  it('returns false when there is nothing to redo', () => {
    const history = new HistoryManager(createContext());

    expect(history.redo()).toBe(false);
  });

  it('does not move an entry when restoration fails', () => {
    const restore = vi.spyOn(StateSnapshot, 'restoreEditorState').mockImplementation(() => {
      throw new Error('Restoration failed');
    });

    const history = new HistoryManager(createContext());

    history.record(createSnapshot('A'), createSnapshot('B'));

    expect(() => history.undo()).toThrow('Restoration failed');

    expect(history.getUndoCount()).toBe(1);
    expect(history.getRedoCount()).toBe(0);

    restore.mockRestore();
  });
});
