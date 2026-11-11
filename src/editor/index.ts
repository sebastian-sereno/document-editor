export { CaretManager } from './caret/CaretManager.js';
export { EditorDocument } from './core/Document.js';

export type { DocumentPosition } from './core/DocumentPosition.js';
export { createPosition, getNodeLength } from './core/DocumentPosition.js';
export type { Cursor, CursorSnapshot, PositionMapper } from './cursors/Cursor.js';
export { CursorManager } from './cursors/CursorManager.js';
export type {
  Operation,
  OperationContext,
  OperationModification,
} from './operations/Operation.js';
export type { OperationManagerOptions } from './operations/OperationManager.js';
export { OperationManager } from './operations/OperationManager.js';
export type {
  OperationResult,
  OperationStatus,
} from './operations/OperationResult.js';
export {
  createSelection,
  type Selection,
  type SelectionDirection,
} from './selection/Selection.js';
export {
  SelectionManager,
  type SelectionMapper,
} from './selection/SelectionManager.js';
export {
  captureDocument,
  restoreDocument,
} from './transactions/DocumentSnapshot.js';
export type {
  CursorPositionSnapshot,
  EditorStateContext,
  EditorStateSnapshot,
} from './transactions/EditorStateSnapshot.js';
export {
  captureEditorState,
  restoreEditorState,
} from './transactions/EditorStateSnapshot.js';
export { HistoryManager } from './transactions/HistoryManager.js';
export {
  capturePosition,
  PositionSnapshot,
  restorePosition,
} from './transactions/PositionSnapshot.js';
export type {
  Transaction,
  TransactionStatus,
} from './transactions/Transaction.js';
export { TransactionManager } from './transactions/TransactionManager.js';
