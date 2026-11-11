import { describe, expect, it } from 'vitest';
import * as StateSnapshot from '../../../src/editor/transactions/EditorStateSnapshot.js';
import { HistoryManager } from '../../../src/editor/transactions/HistoryManager.js';
import { TransactionManager } from '../../../src/editor/transactions/TransactionManager.js';

function createContext() {
  const root = document.createElement('div');
  root.innerHTML = '<p>Hello</p>';

  return {
    caret: {
      clear: () => {},
      get: () => null,
      set: () => {},
    } as never,
    cursors: {
      getAll: () => [],
      restoreAll: () => {},
    } as never,
    document: {
      getRoot: () => root,
    } as never,
  };
}

describe('History transaction safety', () => {
  it('prevents undo during active transactions', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();

    expect(() => history.undo()).toThrow('Cannot navigate history during an active transaction.');

    manager.rollback();
  });

  it('prevents redo during active transactions', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();

    expect(() => history.redo()).toThrow('Cannot navigate history during an active transaction.');

    manager.rollback();
  });

  it('allows history navigation after commit', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();
    manager.commit();

    expect(() => history.undo()).not.toThrow();
  });
});
