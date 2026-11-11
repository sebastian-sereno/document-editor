import type { DocumentPosition } from './DocumentPosition.js';

export class EditorDocument {
  constructor(public readonly root: HTMLElement) {}

  contains(node: Node): boolean {
    return node === this.root || this.root.contains(node);
  }

  validatePosition(position: DocumentPosition): boolean {
    const { node, offset } = position;

    if (!this.contains(node)) {
      return false;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      return false;
    }

    const length =
      node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;

    return offset <= length;
  }

  getRoot(): HTMLElement {
    return this.root;
  }
}
