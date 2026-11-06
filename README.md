# DOM Reconciler

> A lightweight DOM reconciliation utility that updates an existing DOM tree from an Emmet-like abbreviation without unnecessarily replacing existing elements.

DOMReconciler applies structural and content changes while preserving DOM node identity wherever possible. This helps avoid unnecessary DOM mutations and keeps existing element references intact.

## Features
- **Preserves element identity:** Updates existing elements instead of replacing unaffected nodes.
- **Updates text content:** Changes text while keeping the original DOM elements.
- **Removes obsolete elements:** Removes children that are no longer present in the desired structure without replacing their parent.
- **Reorders keyed elements:** Moves existing elements into the requested order while preserving their identity.
- **Idempotent updates:** Applying the same abbreviation multiple times produces no additional mutations.
- **Mutation reporting:** Returns information about DOM mutations performed during reconciliation.

## Installation

Installation instructions are not yet specified.

## Usage

Import DOMReconciler and create an instance:

```ts
import { DOMReconciler } from './src/reconciler';

const root = document.createElement('div');
const reconciler = new DOMReconciler();

const result = reconciler.apply(root, 'div>section>h1{Welcome}+p{Hello world}+button{Save}');

console.log(root);
console.log(result.mutations);
```

The `apply()` method takes two arguments:

| Argument     | Description                                    |
|--------------|------------------------------------------------|
| root         | The DOM element to reconcile.                  |
| abbreviation | A string describing the desired DOM structure. |

It returns a result containing a mutations collection describing the changes made.

## Abbreviation Syntax

The reconciler accepts an Emmet-like syntax for describing DOM structures.

Examples:

### Nested elements
```
div>section>h1
```

Creates a nested structure:

```HTML
<div>
  <section>
    <h1></h1>
  </section>
</div>
```

Sibling elements
```
div>h1+p+button
```

Creates multiple sibling elements:

```HTML
<div>
  <h1></h1>
  <p></p>
  <button></button>
</div>
```

### Text content

Use curly braces to specify text content:

```
div>h1{Welcome}+p{Hello world}
```

### Attributes

Use square brackets to specify attributes:

```
div>ul>li[data-key="a"]{Item A}
```

### Combining syntax
```
div>section>h1{Welcome}+p{Description}+button[type="submit"]{Save}
```

## Reconciliation Behavior
### 1. Preserving unaffected elements

When text content changes, existing DOM elements are preserved.

For example, changing a paragraph from Old text to New text updates the paragraph's content without replacing the paragraph, its parent, or neighboring elements.

### 2. Removing obsolete children

When an element is removed from the desired structure, the reconciler removes that child while preserving its parent and remaining children.

### 3. Reordering keyed elements

Elements with matching data-key attributes can be reordered without replacing their underlying DOM nodes.

For example:

Before:

```HTML
<ul>
  <li data-key="a">A</li>
  <li data-key="b">B</li>
  <li data-key="c">C</li>
</ul>
```

Desired order:

```
ul>li[data-key="c"]{C}+li[data-key="a"]{A}+li[data-key="b"]{B}
```

The reconciler moves the existing elements into the new order while preserving their references.

### 4. Idempotency

Applying the same abbreviation to an already reconciled DOM tree should not produce additional mutations.

This means repeated calls with an unchanged desired structure leave existing elements intact.

## Testing

The project uses Vitest for testing.

The test suite covers four core behaviors:

| Test                          | Expected behavior                                                 |
|-------------------------------|-------------------------------------------------------------------|
| Preserves unaffected elements | Existing elements remain the same DOM objects after text updates. |
| Removes obsolete children     | Unneeded children are removed without replacing their parent.     |
| Reorders keyed elements       | Existing keyed elements are moved without replacement.            |
| Idempotent reconciliation     | Reapplying an unchanged structure produces zero mutations.        |

Run the tests with:

```bash
npx vitest
```

Or, if configured in package.json:

```bash
npm test
```

### Design Goals

The primary goal of DOMReconciler is to minimize unnecessary DOM changes.

Rather than rebuilding an entire subtree whenever the desired markup changes, it attempts to reconcile the existing tree with the requested structure.

This approach provides several benefits:

- Preserves references to existing DOM elements.
- Reduces unnecessary DOM operations.
- Supports efficient structural updates.
- Makes repeated reconciliation predictable.
- Allows consumers to retain references to elements across updates.

## Project Status

The current test suite validates the core reconciliation behaviors:

- Text updates.
- Removal of obsolete children.
- Reordering keyed elements.
- Idempotent updates.
