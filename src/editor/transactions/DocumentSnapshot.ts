export interface DocumentSnapshot {
  readonly children: readonly Node[];
}

export function captureDocument(root: Node): DocumentSnapshot {
  return {
    children: Array.from(root.childNodes).map((node) => node.cloneNode(true)),
  };
}

export function restoreDocument(root: Node, snapshot: DocumentSnapshot): void {
  const restoredChildren = snapshot.children.map((node) => node.cloneNode(true));

  if (root instanceof HTMLElement) {
    root.replaceChildren(...restoredChildren);
  } else {
    root.childNodes.forEach((child) => {
      root.removeChild(child);
    });

    restoredChildren.forEach((child) => {
      root.appendChild(child);
    });
  }
}
