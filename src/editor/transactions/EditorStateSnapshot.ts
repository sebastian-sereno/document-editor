import type { CaretManager } from '../caret/CaretManager.js';
import type { EditorDocument } from '../core/Document.js';
import type { DocumentPosition } from '../core/DocumentPosition.js';
import type { Cursor } from '../cursors/Cursor.js';
import type { CursorManager } from '../cursors/CursorManager.js';
import type { DocumentSnapshot } from './DocumentSnapshot.js';
import { captureDocument } from './DocumentSnapshot.js';
import { capturePosition, type PositionSnapshot, restorePosition } from './PositionSnapshot.js';

export interface CursorPositionSnapshot {
  readonly id: string;
  readonly position: PositionSnapshot;
}

export interface EditorStateSnapshot {
  readonly document: DocumentSnapshot;
  readonly caret: PositionSnapshot | null;
  readonly cursors: readonly CursorPositionSnapshot[];
}

export interface EditorStateContext {
  readonly document: EditorDocument;
  readonly caret: CaretManager;
  readonly cursors: CursorManager;
}

export function captureEditorState(context: EditorStateContext): EditorStateSnapshot {
  const root = context.document.getRoot();
  const caret = context.caret.get();

  return {
    caret: caret ? capturePosition(root, caret) : null,

    cursors: context.cursors.getAll().map((cursor) => ({
      id: cursor.id,
      position: capturePosition(root, cursor.position),
    })),

    document: captureDocument(root),
  };
}

function createStagedRoot(root: Node, snapshot: DocumentSnapshot): Node {
  if (!snapshot || !Array.isArray(snapshot.children)) {
    throw new TypeError('Invalid document snapshot.');
  }

  const stagedRoot = root.cloneNode(false);

  for (const child of snapshot.children) {
    if (!child || typeof child.cloneNode !== 'function') {
      throw new TypeError('Invalid document snapshot child.');
    }

    stagedRoot.appendChild(child.cloneNode(true));
  }

  return stagedRoot;
}

export function restoreEditorState(
  context: EditorStateContext,
  snapshot: EditorStateSnapshot,
): void {
  const root = context.document.getRoot();

  // Stage the complete document independently.
  const stagedRoot = createStagedRoot(root, snapshot.document);

  if (!Array.isArray(snapshot.cursors)) {
    throw new TypeError('Invalid cursor snapshot collection.');
  }

  // Resolve and validate the caret.
  const stagedCaret: DocumentPosition | null =
    snapshot.caret !== null ? restorePosition(stagedRoot, snapshot.caret) : null;

  // Resolve and validate every cursor.
  const stagedCursors: Cursor[] = snapshot.cursors.map((cursor) => {
    if (!cursor || typeof cursor.id !== 'string' || cursor.id.trim().length === 0) {
      throw new TypeError('Invalid cursor ID in snapshot.');
    }

    return {
      id: cursor.id,
      position: restorePosition(stagedRoot, cursor.position),
    };
  });

  // Reject duplicate IDs.
  const cursorIds = new Set(stagedCursors.map((cursor) => cursor.id));

  if (cursorIds.size !== stagedCursors.length) {
    throw new Error('Duplicate cursor IDs in snapshot.');
  }

  // Prepare live-tree positions before committing.
  // These positions will be resolved again after replacement.
  const liveCaretSnapshot = snapshot.caret;
  const liveCursorSnapshots = snapshot.cursors;

  // Commit the document.
  root.replaceChildren(...Array.from(stagedRoot.childNodes));

  // Resolve positions against the committed document.
  const liveCaret = liveCaretSnapshot ? restorePosition(root, liveCaretSnapshot) : null;

  const liveCursors: Cursor[] = liveCursorSnapshots.map((cursor) => ({
    id: cursor.id,
    position: restorePosition(root, cursor.position),
  }));

  // Restore logical editing state.
  if (liveCaret) {
    context.caret.set(liveCaret);
  } else {
    context.caret.clear();
  }

  context.cursors.restoreAll(liveCursors);
}
