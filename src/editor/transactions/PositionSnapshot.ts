import type { DocumentPosition } from '../core/DocumentPosition.js';
import { getNodeLength } from '../core/DocumentPosition.js';

export interface PositionSnapshot {
  readonly path: readonly number[];
  readonly offset: number;
}

function getMaximumOffset(node: Node): number {
  return getNodeLength(node);
}

function validateOffset(node: Node, offset: number): void {
  if (!Number.isInteger(offset)) {
    throw new RangeError('Position offset must be an integer.');
  }

  if (offset < 0 || offset > getMaximumOffset(node)) {
    throw new RangeError('Position offset is outside the node.');
  }
}

function isWithinRoot(root: Node, node: Node): boolean {
  let current: Node | null = node;

  while (current) {
    if (current === root) {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

export function capturePosition(root: Node, position: DocumentPosition): PositionSnapshot {
  if (!position?.node) throw new TypeError('Invalid document position.');
  const { node, offset } = position;

  if (!isWithinRoot(root, node)) throw new Error('Position is outside the document root.');
  validateOffset(node, offset);

  const path: number[] = [];
  let current: Node = node;

  while (current !== root) {
    const parent = current.parentNode;
    if (!parent) throw new Error('Position is outside the document root.');

    const index = Array.prototype.indexOf.call(parent.childNodes, current) as number;
    if (index < 0) throw new Error('Unable to resolve position path.');

    path.unshift(index);
    current = parent;
  }

  return Object.freeze({
    offset,
    path: Object.freeze(path),
  });
}

export function resolvePositionNode(root: Node, path: readonly number[]): Node {
  if (!Array.isArray(path)) throw new TypeError('Position path must be an array.');

  let current = root;

  for (const index of path) {
    if (!Number.isInteger(index) || index < 0) throw new RangeError('Invalid position path.');

    const child = current.childNodes[index];
    if (!child) throw new Error('Position path does not exist.');

    current = child;
  }

  return current;
}

export function restorePosition(root: Node, snapshot: PositionSnapshot): DocumentPosition {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('Invalid position snapshot.');

  const node = resolvePositionNode(root, snapshot.path);
  validateOffset(node, snapshot.offset);

  return Object.freeze({
    node,
    offset: snapshot.offset,
  });
}
