# TypeScript DOM Editing Engine

A modular, transaction-aware TypeScript DOM editing engine designed around centralized document modification, logical editing positions, operation management, and reliable undo/redo functionality.

## Project Philosophy
> The goal is not simply to manipulate DOM elements.

The goal is to build a predictable, extensible, and transactionally reliable editing engine in which every document modification is coordinated, every editing position is managed, and every committed change can be reversed.

## Features
- **Preserves element identity:** Updates existing elements instead of replacing unaffected nodes.
- **Updates text content:** Changes text while keeping the original DOM elements.
- **Removes obsolete elements:** Removes children that are no longer present in the desired structure without replacing their parent.
- **Reorders keyed elements:** Moves existing elements into the requested order while preserving their identity.
- **Idempotent updates:** Applying the same abbreviation multiple times produces no additional mutations.
- **Mutation reporting:** Returns information about DOM mutations performed during reconciliation.

## Overview
The TypeScript DOM Editing Engine is a modular editing framework for manipulating structured DOM documents while maintaining consistent editing positions, transactional integrity, and reversible document modifications.

The project is designed with a strong separation of responsibilities. Each subsystem manages a specific aspect of editing, while centralized operation management coordinates all document modifications.

The architecture aims to support:

- Structured DOM manipulation.
- Logical caret and cursor management.
- Multiple editing positions.
- Atomic document transactions.
- Undo and redo functionality.
- Centralized modification execution.
- Position reconciliation after document changes.
- Text, HTML, and DOM node insertion.
- Extensible formatting operations.
- Document integrity validation.
- A unified public Editor API.

The long-term goal is to provide a reliable foundation for building advanced browser-based editing systems.

## Development Roadmap
- [x] Define operation interface.
- [x] Define operation result.
- [x] Draft centralized execution manager.
- [x] Draft lifecycle hooks.
- [x] Draft transaction integration.
- [x] Draft descending execution.
- [x] Draft overlap detection.
- [x] Draft operation tests.
- [x] Supply and review core dependencies.
- [ ] Fix failure-status handling.
- [ ] Refine transaction recovery reporting.
- [ ] Add modification position mapping.
- [ ] Add CaretManager reconciliation.
- [ ] Integrate CursorManager reconciliation.
- [ ] Verify nested transaction failure behavior.
- [ ] Complete overlap boundary tests.
- [ ] Complete operation tests.
- [ ] Run transaction regression tests.
- [ ] Run full test suite.
- [ ] Verify TypeScript compilation.
- [ ] Verify production build.

## Installation
The project uses TypeScript and Vitest.

Install dependencies:
```bash
npm install
```
Build and test commands depend on the scripts configured in package.json.

Development Commands
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript type checking
npm run typecheck

# Build production output
npm run build
```
