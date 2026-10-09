import type { ElementNodeSpec, NodeSpec } from './emmet.js';
import { parseEmmet } from './emmet.js';

export interface ReconcileOptions {
  /**
   * Attribute used for stable identity among siblings.
   */
  keyAttribute?: string;

  /**
   * When true, preserve current input/textarea values and
   * checked state rather than enforcing the desired values.
   */
  preserveFormState?: boolean;
}

export type Mutation =
  | { type: 'create'; node: Node }
  | { type: 'remove'; node: Node }
  | { type: 'move'; node: Node; parent: Node }
  | { type: 'text'; node: Node; value: string }
  | { type: 'attribute'; node: Element; name: string; value: string | null };

export interface ReconcileResult {
  mutations: Mutation[];
  created: number;
  removed: number;
  moved: number;
  updated: number;
}

type Match = {
  desired: NodeSpec;
  existing?: Node;
};

export class DOMReconciler {
  private readonly keyAttribute: string;
  private readonly preserveFormState: boolean;

  constructor(options: ReconcileOptions = {}) {
    this.keyAttribute = options.keyAttribute ?? 'data-key';
    this.preserveFormState = options.preserveFormState ?? true;
  }

  /**
   * Reconcile the CHILDREN of root against the children of
   * the parsed Emmet root. The supplied root is never replaced.
   *
   * Example:
   *   reconciler.apply(app, "div#app>h1{Hello}+p{World}");
   *
   * Here `app` is retained, and the desired div is used as
   * a template for its children.
   */
  apply(root: Element, abbreviation: string): ReconcileResult {
    const desiredRoot = parseEmmet(abbreviation);
    return this.reconcileContainer(root, desiredRoot.children);
  }

  /**
   * Reconcile an existing element against a complete spec.
   * The existing root is retained; only its attributes and
   * children are reconciled. Its tag cannot be changed.
   */
  applySpec(root: Element, desired: ElementNodeSpec): ReconcileResult {
    const mutations: Mutation[] = [];

    this.updateAttributes(root, desired, mutations);
    this.reconcileChildren(root, desired.children, mutations);
    return this.summarize(mutations);
  }

  private reconcileContainer(root: Element, desiredChildren: NodeSpec[]): ReconcileResult {
    const mutations: Mutation[] = [];
    this.reconcileChildren(root, desiredChildren, mutations);
    return this.summarize(mutations);
  }

  private summarize(mutations: Mutation[]): ReconcileResult {
    return {
      created: mutations.filter((m) => m.type === 'create').length,
      moved: mutations.filter((m) => m.type === 'move').length,
      mutations,
      removed: mutations.filter((m) => m.type === 'remove').length,
      updated: mutations.filter((m) => m.type === 'text' || m.type === 'attribute').length,
    };
  }

  private createNode(spec: NodeSpec, doc: Document): Node {
    if (spec.type === 'text') {
      return doc.createTextNode(spec.value);
    }

    const namespace = this.namespaceFor(spec.tag);
    const element = namespace
      ? doc.createElementNS(namespace, spec.tag)
      : doc.createElement(spec.tag);

    this.updateAttributes(element, spec, []);
    this.reconcileChildren(element, spec.children, []);
    return element;
  }

  private namespaceFor(tag: string): string | null {
    // SVG and MathML support can be extended to inherit
    // the namespace from the parent during creation.
    if (tag.toLowerCase() === 'svg') {
      return 'http://www.w3.org/2000/svg';
    }

    if (tag.toLowerCase() === 'math') {
      return 'http://www.w3.org/1998/Math/MathML';
    }

    return null;
  }

  private isCompatible(node: Node, spec: NodeSpec): boolean {
    if (spec.type === 'text') {
      return node.nodeType === Node.TEXT_NODE;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const element = node as Element;
    const tag = spec.tag.toLowerCase();

    if (element.localName.toLowerCase() !== tag) return false;

    const desiredNamespace = this.namespaceFor(spec.tag);

    // For HTML elements, namespaceURI is the HTML namespace.
    if (tag === 'svg' || tag === 'math') {
      return element.namespaceURI === desiredNamespace;
    }

    return element.namespaceURI === 'http://www.w3.org/1999/xhtml';
  }

  private keyOf(node: Node): string | null {
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const value = (node as Element).getAttribute(this.keyAttribute);
    return value ? value : null;
  }

  private specKey(spec: NodeSpec): string | null {
    if (spec.type !== 'element') return null;
    const value = spec.attributes[this.keyAttribute];
    return value ? value : null;
  }

  /**
   * Match desired children against old children.
   * Explicit keys win; unkeyed nodes are matched by order
   * and compatibility. Keys must be unique among siblings.
   */
  private matchChildren(oldChildren: Node[], desiredChildren: NodeSpec[]): Match[] {
    const matches: Match[] = desiredChildren.map((desired) => ({ desired }));
    const used = new Set<Node>();

    const oldByKey = new Map<string, Node>();

    for (const node of oldChildren) {
      const key = this.keyOf(node);

      if (key !== null) {
        if (oldByKey.has(key)) {
          throw new Error(`Duplicate DOM key "${key}" among siblings.`);
        }
        oldByKey.set(key, node);
      }
    }

    const desiredKeys = new Set<string>();

    // First pass: match explicit keys.
    for (const match of matches) {
      const key = this.specKey(match.desired);
      if (key === null) continue;

      if (desiredKeys.has(key)) {
        throw new Error(`Duplicate desired key "${key}" among siblings.`);
      }

      desiredKeys.add(key);
      const candidate = oldByKey.get(key);

      if (!candidate) continue;
      if (used.has(candidate)) continue;
      if (!this.isCompatible(candidate, match.desired)) continue;

      match.existing = candidate;
      used.add(candidate);
    }

    // Second pass: match unkeyed nodes to compatible old
    // unkeyed nodes in order. Keyed nodes are not stolen.
    let cursor = 0;

    for (const match of matches) {
      if (match.existing) continue;
      if (this.specKey(match.desired) !== null) continue;

      while (cursor < oldChildren.length) {
        const candidate = oldChildren[cursor++];
        if (!candidate) continue;
        if (used.has(candidate)) continue;
        if (this.keyOf(candidate) !== null) continue;

        if (this.isCompatible(candidate, match.desired)) {
          match.existing = candidate;
          used.add(candidate);
          break;
        }
      }
    }

    return matches;
  }

  private reconcileNode(
    existing: Node | undefined,
    desired: NodeSpec,
    mutations: Mutation[],
  ): Node {
    if (!existing || !this.isCompatible(existing, desired)) {
      const doc = existing?.ownerDocument ?? document;
      if (!doc) throw new Error('A browser Document is required to create DOM nodes.');

      const replacement = this.createNode(desired, doc);
      mutations.push({ node: replacement, type: 'create' });

      if (existing?.parentNode) {
        existing.parentNode.replaceChild(existing, replacement);
        mutations.push({ node: existing, type: 'remove' });
      }

      return replacement;
    }

    if (desired.type === 'text') {
      const text = existing as Text;

      if (text.nodeValue !== desired.value) {
        text.nodeValue = desired.value;
        mutations.push({
          node: text,
          type: 'text',
          value: desired.value,
        });
      }

      return text;
    }

    const element = existing as Element;
    this.updateAttributes(element, desired, mutations);
    this.reconcileChildren(element, desired.children, mutations);

    return element;
  }

  private updateAttributes(
    element: Element,
    desired: ElementNodeSpec,
    mutations: Mutation[],
  ): void {
    const desiredAttributes = { ...desired.attributes };

    if (desired.id !== undefined) {
      desiredAttributes.id = desired.id;
    }

    // Preserve user-edited form state by default.
    const preserveValue =
      this.preserveFormState &&
      (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement);

    const liveValue = preserveValue
      ? (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
      : undefined;

    const liveChecked =
      this.preserveFormState && element instanceof HTMLInputElement ? element.checked : undefined;

    for (const attr of Array.from(element.attributes)) {
      if (!(attr.name in desiredAttributes)) {
        element.removeAttribute(attr.name);
        mutations.push({
          name: attr.name,
          node: element,
          type: 'attribute',
          value: null,
        });
      }
    }

    for (const [name, value] of Object.entries(desiredAttributes)) {
      const normalized = String(value);

      if (element.getAttribute(name) !== normalized) {
        element.setAttribute(name, normalized);
        mutations.push({
          name,
          node: element,
          type: 'attribute',
          value: normalized,
        });
      }
    }

    // Restore live state in case attribute changes affect it.
    if (preserveValue && liveValue !== undefined) {
      (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = liveValue;
    }

    if (liveChecked !== undefined && element instanceof HTMLInputElement) {
      element.checked = liveChecked;
    }
  }

  private reconcileChildren(
    parent: Element,
    desiredChildren: NodeSpec[],
    mutations: Mutation[],
  ): void {
    const oldChildren = Array.from(parent.childNodes);
    const matches = this.matchChildren(oldChildren, desiredChildren);

    const nextChildren = matches.map((match) =>
      this.reconcileNode(match.existing, match.desired, mutations),
    );

    const retained = new Set(nextChildren);

    // Remove children not present in the desired result.
    for (const oldNode of oldChildren) {
      if (!retained.has(oldNode) && oldNode.parentNode === parent) {
        parent.removeChild(oldNode);
        mutations.push({ node: oldNode, type: 'remove' });
      }
    }

    // Move/insert nodes into their target order.
    let cursor: ChildNode | null = parent.firstChild;

    for (const node of nextChildren) {
      if (node === cursor) {
        cursor = cursor.nextSibling;
        continue;
      }

      const wasConnectedHere = node.parentNode === parent;
      parent.insertBefore(node, cursor);
      mutations.push(wasConnectedHere ? { node, parent, type: 'move' } : { node, type: 'create' });
    }
  }
}
