import { describe, expect, it, vi } from 'vitest';
import { CaretManager } from '../../../src/editor/caret/CaretManager.js';
import { EditorDocument } from '../../../src/editor/core/Document.js';
import { createPosition } from '../../../src/editor/core/DocumentPosition.js';
import { CursorManager } from '../../../src/editor/cursors/CursorManager.js';
import type { Operation } from '../../../src/editor/operations/Operation.js';
import { OperationManager } from '../../../src/editor/operations/OperationManager.js';
import { HistoryManager } from '../../../src/editor/transactions/HistoryManager.js';
import { TransactionManager } from '../../../src/editor/transactions/TransactionManager.js';

function createFixture() {
  const root = document.createElement('div');

  root.innerHTML = '<p>abcdef</p>';

  const documentModel = new EditorDocument(root);
  const caret = new CaretManager(documentModel);
  const cursors = new CursorManager(documentModel);

  const context = { caret, cursors, document: documentModel };

  const history = new HistoryManager(context);
  const transactions = new TransactionManager(context, history);
  const operations = new OperationManager(documentModel, transactions);

  return { caret, context, cursors, documentModel, history, operations, root, transactions };
}

function getTextNode(root: HTMLElement): Text {
  return root.querySelector('p')!.firstChild as Text;
}

describe('OperationManager', () => {
  it('executes a valid operation', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              text.insertData(2, 'X');
            },
            from: createPosition(text, 2),
            to: createPosition(text, 2),
          },
        ];
      },
      type: 'test-insertion',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('success');
    expect(result.modificationsExecuted).toBe(1);
    expect(editor.root.textContent).toBe('abXcdef');
    expect(editor.history.getUndoCount()).toBe(1);
  });

  it('sorts modifications in descending document order', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const executionOrder: number[] = [];

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              executionOrder.push(1);
              text.deleteData(1, 1);
            },
            from: createPosition(text, 1),
            to: createPosition(text, 2),
          },
          {
            execute() {
              executionOrder.push(4);
              text.deleteData(4, 1);
            },
            from: createPosition(text, 4),
            to: createPosition(text, 5),
          },
        ];
      },
      type: 'descending-test',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('success');
    expect(executionOrder).toEqual([4, 1]);
    expect(editor.root.textContent).toBe('acdf');
  });

  it('rejects overlapping modifications before execution', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const execute = vi.fn();

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute,
            from: createPosition(text, 1),
            to: createPosition(text, 4),
          },
          {
            execute,
            from: createPosition(text, 3),
            to: createPosition(text, 5),
          },
        ];
      },
      type: 'overlap-test',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Overlapping');
    expect(execute).not.toHaveBeenCalled();
    expect(editor.root.textContent).toBe('abcdef');
  });

  it('rejects duplicate insertions at the same position', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const execute = vi.fn();

    const operation: Operation = {
      getModifications() {
        const position = createPosition(text, 2);

        return [
          {
            execute,
            from: position,
            to: position,
          },
          {
            execute,
            from: position,
            to: position,
          },
        ];
      },
      type: 'duplicate-insertion',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('failed');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects invalid operations', () => {
    const editor = createFixture();

    const result = editor.operations.execute({
      getModifications: () => [],
      type: '',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(editor.history.getUndoCount()).toBe(0);
  });

  it('rolls back modifications when execution fails', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              text.insertData(1, 'X');

              throw new Error('Execution failed.');
            },
            from: createPosition(text, 1),
            to: createPosition(text, 1),
          },
        ];
      },
      type: 'failure-test',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('rolled-back');
    expect(result.error?.message).toBe('Execution failed.');
    expect(editor.root.textContent).toBe('abcdef');
    expect(editor.history.getUndoCount()).toBe(0);
    expect(editor.transactions.hasActiveTransaction()).toBe(false);
  });

  it('rolls back when beforeExecute fails', () => {
    const editor = createFixture();

    const operation: Operation = {
      beforeExecute() {
        throw new Error('Before hook failed.');
      },

      getModifications: () => [],
      type: 'before-failure',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('rolled-back');
    expect(editor.history.getUndoCount()).toBe(0);
  });

  it('rolls back when afterExecute fails', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const operation: Operation = {
      afterExecute() {
        throw new Error('After hook failed.');
      },

      getModifications() {
        return [
          {
            execute() {
              text.insertData(1, 'X');
            },
            from: createPosition(text, 1),
            to: createPosition(text, 1),
          },
        ];
      },
      type: 'after-failure',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('rolled-back');
    expect(editor.root.textContent).toBe('abcdef');
    expect(editor.history.getUndoCount()).toBe(0);
  });

  it('rolls back when result validation fails', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              text.insertData(1, 'X');
            },
            from: createPosition(text, 1),
            to: createPosition(text, 1),
          },
        ];
      },
      type: 'result-failure',

      validateResult: () => false,
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('rolled-back');
    expect(editor.root.textContent).toBe('abcdef');
  });

  it('joins an existing transaction', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    editor.transactions.begin();

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              text.insertData(1, 'X');
            },
            from: createPosition(text, 1),
            to: createPosition(text, 1),
          },
        ];
      },
      type: 'nested-operation',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('success');
    expect(editor.transactions.getDepth()).toBe(1);
    expect(editor.history.getUndoCount()).toBe(0);

    editor.transactions.commit();

    expect(editor.history.getUndoCount()).toBe(1);
  });

  it('aborts the outer transaction when a nested operation fails', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    editor.transactions.begin();

    text.insertData(1, 'X');

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              throw new Error('Nested failure.');
            },
            from: createPosition(text, 2),
            to: createPosition(text, 2),
          },
        ];
      },
      type: 'nested-failure',
    };

    const result = editor.operations.execute(operation);

    expect(result.status).toBe('rolled-back');
    expect(editor.root.textContent).toBe('abcdef');
    expect(editor.transactions.hasActiveTransaction()).toBe(false);
  });

  it('creates one history entry for a successful operation', () => {
    const editor = createFixture();

    const text = getTextNode(editor.root);

    const operation: Operation = {
      getModifications() {
        return [
          {
            execute() {
              text.insertData(1, 'X');
            },
            from: createPosition(text, 1),
            to: createPosition(text, 1),
          },
        ];
      },
      type: 'history-test',
    };

    editor.operations.execute(operation);

    expect(editor.history.getUndoCount()).toBe(1);

    expect(editor.history.undo()).toBe(true);
    expect(editor.root.textContent).toBe('abcdef');

    expect(editor.history.redo()).toBe(true);
    expect(editor.root.textContent).toBe('aXbcdef');
  });
});
