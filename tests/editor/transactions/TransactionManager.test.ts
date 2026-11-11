import { describe, expect, it, vi } from 'vitest';
import { CaretManager } from '../../../src/editor/caret/CaretManager.js';
import { EditorDocument } from '../../../src/editor/core/Document.js';
import { CursorManager } from '../../../src/editor/cursors/CursorManager.js';
import * as StateSnapshot from '../../../src/editor/transactions/EditorStateSnapshot.js';
import { HistoryManager } from '../../../src/editor/transactions/HistoryManager.js';
import { TransactionManager } from '../../../src/editor/transactions/TransactionManager.js';

function createContext() {
  const root = document.createElement('div');
  root.innerHTML = '<p>Original</p>';

  return {
    caret: {
      clear: vi.fn(),
      get: () => null,
      set: vi.fn(),
    } as never,

    cursors: {
      getAll: () => [],
      restoreAll: vi.fn(),
      setAll: vi.fn(),
    } as never,
    document: {
      getRoot: () => root,
    } as never,

    root,
  };
}

function createTransactionFixture() {
  const root = document.createElement('div');
  root.innerHTML = '<p>Hello</p>';

  const documentModel = new EditorDocument(root);
  const caret = new CaretManager(documentModel);
  const cursors = new CursorManager(documentModel);

  const context = { caret, cursors, document: documentModel };

  const history = new HistoryManager(context);
  const transactions = new TransactionManager(context, history);

  return { caret, context, cursors, history, root, transactions };
}

describe('TransactionManager', () => {
  it('begins a transaction', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    const transaction = manager.begin();

    expect(transaction.status).toBe('active');
    expect(manager.hasActiveTransaction()).toBe(true);
    expect(manager.getDepth()).toBe(1);
  });

  it('commits a transaction to history', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();

    context.root.innerHTML = '<p>Modified</p>';

    manager.commit();

    expect(manager.hasActiveTransaction()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('rolls back document modifications', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();

    context.root.innerHTML = '<p>Modified</p>';

    manager.rollback();

    expect(context.root.innerHTML).toBe('<p>Original</p>');

    expect(manager.hasActiveTransaction()).toBe(false);
  });

  it('supports nested transactions', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    const outer = manager.begin();
    const inner = manager.begin();

    expect(inner.id).toBe(outer.id);
    expect(manager.getDepth()).toBe(2);

    manager.commit();

    expect(manager.hasActiveTransaction()).toBe(true);
    expect(manager.getDepth()).toBe(1);

    manager.commit();

    expect(manager.hasActiveTransaction()).toBe(false);
    expect(history.getUndoCount()).toBe(1);
  });

  it('rolls back the entire nested transaction', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();
    manager.begin();

    context.root.innerHTML = '<p>Modified</p>';

    manager.rollback();

    expect(context.root.innerHTML).toBe('<p>Original</p>');

    expect(manager.hasActiveTransaction()).toBe(false);
    expect(manager.getDepth()).toBe(0);
  });

  it('rejects commit without an active transaction', () => {
    const context = createContext();
    const manager = new TransactionManager(context, new HistoryManager(context));

    expect(() => manager.commit()).toThrow();
  });

  it('rejects rollback without an active transaction', () => {
    const context = createContext();
    const manager = new TransactionManager(context, new HistoryManager(context));

    expect(() => manager.rollback()).toThrow();
  });

  it('clears the active transaction after commit', () => {
    const context = createContext();
    const manager = new TransactionManager(context, new HistoryManager(context));

    const transaction = manager.begin();

    manager.commit();

    expect(transaction.status).toBe('committed');
    expect(manager.getActiveTransaction()).toBeNull();
  });

  it('restores the original state after a failed commit snapshot', () => {
    const context = createContext();
    const history = new HistoryManager(context);

    const manager = new TransactionManager(context, history);

    manager.begin();

    context.root.innerHTML = '<p>Modified</p>';

    const spy = vi.spyOn(StateSnapshot, 'captureEditorState');

    spy.mockImplementationOnce(() => {
      throw new Error('Snapshot failed');
    });

    expect(() => manager.commit()).toThrow('Snapshot failed');

    expect(context.root.innerHTML).toBe('<p>Original</p>');

    expect(manager.hasActiveTransaction()).toBe(false);

    spy.mockRestore();
  });

  describe('TransactionManager integration', () => {
    it('connects the history transaction guard', () => {
      const { context, history, transactions } = createTransactionFixture();

      transactions.begin();

      expect(() => history.undo()).toThrow('Cannot navigate history during an active transaction.');

      expect(() => history.redo()).toThrow('Cannot navigate history during an active transaction.');

      transactions.rollback();
    });

    it('supports nested transactions', () => {
      const { transactions } = createTransactionFixture();

      const first = transactions.begin();
      const second = transactions.begin();

      expect(first).toBe(second);
      expect(transactions.getDepth()).toBe(2);

      transactions.commit();

      expect(transactions.getDepth()).toBe(1);
      expect(transactions.hasActiveTransaction()).toBe(true);

      transactions.commit();

      expect(transactions.getDepth()).toBe(0);
      expect(transactions.hasActiveTransaction()).toBe(false);
    });

    it('rolls back the entire nested transaction', () => {
      const { transactions } = createTransactionFixture();

      transactions.begin();
      transactions.begin();

      expect(transactions.getDepth()).toBe(2);

      transactions.rollback();

      expect(transactions.getDepth()).toBe(0);
      expect(transactions.hasActiveTransaction()).toBe(false);
    });

    it('allows history navigation after commit', () => {
      const { transactions, history } = createTransactionFixture();

      transactions.begin();
      transactions.commit();

      expect(transactions.hasActiveTransaction()).toBe(false);
      expect(() => history.undo()).not.toThrow();
    });
  });
});
