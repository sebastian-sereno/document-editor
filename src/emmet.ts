export interface TextNodeSpec {
  type: 'text';
  value: string;
}

export interface ElementNodeSpec {
  type: 'element';
  tag: string;
  id?: string;
  attributes: Record<string, string>;
  children: NodeSpec[];
}

export type NodeSpec = TextNodeSpec | ElementNodeSpec;

type Token = {
  value: string;
  operator?: '+' | '>' | '^' | '*' | '(' | ')';
};

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  let square = 0;
  let curly = 0;

  const flush = () => {
    const value = buffer.trim();
    if (value) tokens.push({ value });
    buffer = '';
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '\\') {
      buffer += char;
      if (i + 1 < input.length) buffer += input[++i];
      continue;
    }

    if (char === '[' && curly === 0) square++;
    if (char === ']' && curly === 0) square--;
    if (char === '{' && square === 0) curly++;
    if (char === '}' && square === 0) curly--;

    if (square === 0 && curly === 0) {
      if (char === '(' || char === ')') {
        flush();
        tokens.push({ operator: char, value: char });
        continue;
      }

      if (char === '>' || char === '+' || char === '^') {
        flush();
        tokens.push({ operator: char, value: char });
        continue;
      }

      // Multiplication is recognized as an operator only
      // when it is not part of an attribute or text block.
      if (char === '*') {
        flush();
        tokens.push({ operator: '*', value: '*' });
        continue;
      }
    }

    buffer += char;
  }

  flush();
  return tokens;
}

function unescapeEmmet(value: string): string {
  return value.replace(/\\(.)/g, '$1');
}

function parseElement(raw: string): ElementNodeSpec {
  const textMatch = raw.match(/\{([^}]*)\}$/);
  const text = textMatch?.at(1) ? unescapeEmmet(textMatch.at(1)!) : undefined;
  const source = textMatch ? raw.slice(0, textMatch.index) : raw;

  const attrMatch = source.match(/\[([^\]]*)\]/);
  const attrSource = attrMatch?.[1] ?? '';
  const attrIndex = attrMatch?.index ?? 0;

  const head = attrMatch
    ? source.slice(0, attrIndex) + source.slice(attrIndex + attrMatch[0].length)
    : source;

  const tagMatch = head.match(/^[\w:-]+/);
  const tag = tagMatch?.[0] || 'div';
  const rest = head.slice(tagMatch?.[0].length ?? 0);

  const node: ElementNodeSpec = {
    attributes: {},
    children: [],
    tag,
    type: 'element',
  };

  // Parse shorthand ID and class syntax.
  const shorthand = /([.#])((?:\\.|[\w-])+)/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = shorthand.exec(rest);
    if (!match) break;

    const value = unescapeEmmet(match[2]!);

    if (match[1] === '#') {
      node.id = value;
    } else {
      const current = node.attributes.class;
      node.attributes.class = current ? `${current} ${value}` : value;
    }
  }

  // Parse [name], [name=value], and quoted values.
  const attrPattern = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;

  while (true) {
    match = attrPattern.exec(attrSource);
    if (!match) break;

    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (!name) continue;
    node.attributes[name] = unescapeEmmet(value);
  }

  if (node.id !== undefined) {
    node.attributes.id = node.id;
  }

  if (text !== undefined) {
    node.children.push({ type: 'text', value: text });
  }

  return node;
}

function cloneSpec(node: NodeSpec): NodeSpec {
  if (node.type === 'text') return { ...node };

  return {
    ...node,
    attributes: { ...node.attributes },
    children: node.children.map(cloneSpec),
  };
}

/**
 * Parses the supported Emmet subset into a desired tree.
 *
 * Examples:
 *   div#app>h1{Hello}+p.note{World}
 *   ul>li[data-key=a]{A}+li[data-key=b]{B}
 *   (header+main+footer)
 *   ul>li.item*3
 */
export function parseEmmet(input: string): ElementNodeSpec {
  const tokens = tokenize(input);
  let pos = 0;

  const readGroup = (): NodeSpec[] => {
    const roots: NodeSpec[] = [];
    // Current parent context for >, +, and ^.
    const parents: ElementNodeSpec[] = [];

    let current: NodeSpec | undefined;
    let pending: '+' | '>' | '^' | undefined;

    const append = (node: NodeSpec) => {
      if (pending === '>') {
        if (current?.type !== 'element') {
          throw new Error('The > operator requires an element parent.');
        }
        current.children.push(node);
        parents.push(current);
      } else if (pending === '^') {
        parents.pop();
        const parent = parents[parents.length - 1];
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else if (pending === '+') {
        const parent = parents[parents.length - 1];
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else {
        const parent = parents[parents.length - 1];
        if (parent) parent.children.push(node);
        else roots.push(node);
      }

      current = node;
      pending = undefined;
    };

    while (pos < tokens.length) {
      const token = tokens[pos++]!;

      if (token.value === ')') break;

      if (token.value === '(') {
        const group = readGroup();
        for (const node of group) append(node);
        continue;
      }

      if (token.operator === '+' || token.operator === '>' || token.operator === '^') {
        pending = token.operator;
        continue;
      }

      if (token.operator === '*') {
        const countToken = tokens[pos++];
        const count = Number(countToken?.value);

        if (!current || !Number.isInteger(count) || count < 1 || count > 1000) {
          throw new Error('Invalid Emmet multiplication.');
        }

        // The first instance already exists. Append clones
        // beside it under the same parent.
        const parent = parents[parents.length - 1];
        const template = current;

        for (let i = 1; i < count; i++) {
          const copy = cloneSpec(template);
          if (parent) parent.children.push(copy);
          else roots.push(copy);
        }

        continue;
      }

      append(parseElement(token.value));
    }

    return roots;
  };

  const roots = readGroup();

  if (pos < tokens.length) {
    throw new Error('Unexpected trailing Emmet tokens.');
  }

  if (roots.length !== 1 || roots[0]?.type !== 'element') {
    throw new Error('Expected exactly one root element. Wrap multiple roots in a container.');
  }

  return roots[0];
}
