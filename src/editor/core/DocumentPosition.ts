export interface DocumentPosition {
  readonly node: Node;
  readonly offset: number;
}

export function createPosition(node: Node, offset: number): DocumentPosition {
  if (!Number.isInteger(offset)) {
    throw new RangeError('Position offset must be an integer.');
  }

  if (offset < 0 || offset > getNodeLength(node)) {
    throw new RangeError('Position offset is outside the node.');
  }

  return Object.freeze({ node, offset });
}

export function getNodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE)
    return node.nodeValue?.length ?? 0;

  return node.childNodes.length;
}
