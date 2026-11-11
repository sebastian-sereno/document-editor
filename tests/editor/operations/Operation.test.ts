import { describe, expect, it, vi } from 'vitest';
import { createPosition } from '../../../src/editor/core/DocumentPosition.js';
import type {
  Operation,
  OperationContext,
  OperationModification,
} from '../../../src/editor/operations/Operation.js';

describe('Operation interface', () => {
  it('supports operation definitions', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p>';

    const textNode = root.querySelector('p')!.firstChild!;

    const execute = vi.fn();

    const modification: OperationModification = {
      execute,
      from: createPosition(textNode, 1),
      to: createPosition(textNode, 3),
    };

    const operation: Operation = {
      getModifications() {
        return [modification];
      },
      type: 'test',
    };

    expect(operation.type).toBe('test');
    expect(operation.getModifications()).toHaveLength(1);

    operation.getModifications()[0].execute();

    expect(execute).toHaveBeenCalledOnce();
  });

  it('supports lifecycle hooks', () => {
    const before = vi.fn();
    const after = vi.fn();

    const context: OperationContext = {
      id: 'operation-1',
    };

    const operation: Operation = {
      afterExecute: after,

      beforeExecute: before,

      getModifications() {
        return [];
      },
      type: 'test',
    };

    operation.beforeExecute?.(context);
    operation.afterExecute?.(context);

    expect(before).toHaveBeenCalledWith(context);
    expect(after).toHaveBeenCalledWith(context);
  });

  it('supports validation hooks', () => {
    const operation: Operation = {
      getModifications() {
        return [];
      },
      type: 'test',

      validate: () => true,
      validateResult: () => true,
    };

    const context = { id: 'operation-1' };

    expect(operation.validate?.(context)).toBe(true);
    expect(operation.validateResult?.(context)).toBe(true);
  });
});
