import { describe, expect, it } from 'vitest';
import { DOMReconciler } from '../src/reconciler';

describe('DOMReconciler', () => {
  it('preserves unaffected elements when text changes', () => {
    const root = document.createElement('div');

    root.innerHTML = `
      <section>
        <h1>Welcome</h1>
        <p>Old text</p>
        <button>Save</button>
      </section>
    `;

    const section = root.querySelector('section')!;
    const heading = root.querySelector('h1')!;
    const paragraph = root.querySelector('p')!;
    const button = root.querySelector('button')!;

    const reconciler = new DOMReconciler();

    reconciler.apply(root, 'div>section>h1{Welcome}+p{New text}+button{Save}');

    expect(root.querySelector('section')).toBe(section);
    expect(root.querySelector('h1')).toBe(heading);
    expect(root.querySelector('p')).toBe(paragraph);
    expect(root.querySelector('button')).toBe(button);
    expect(paragraph.textContent).toBe('New text');
  });

  it('removes obsolete children without replacing the parent', () => {
    const root = document.createElement('div');

    root.innerHTML = `
      <ul>
        <li data-key="a">A</li>
        <li data-key="b">B</li>
      </ul>
    `;

    const list = root.querySelector('ul')!;
    const first = list.querySelector('[data-key="a"]')!;

    const reconciler = new DOMReconciler();

    reconciler.apply(root, 'div>ul>li[data-key="a"]{A}');

    expect(root.querySelector('ul')).toBe(list);
    expect(list.firstElementChild).toBe(first);
    expect(list.children).toHaveLength(1);
  });

  it('reorders keyed elements without replacing them', () => {
    const root = document.createElement('div');

    root.innerHTML = `
      <ul>
        <li data-key="a">A</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      </ul>
    `;

    const list = root.querySelector('ul')!;
    const a = list.children[0];
    const b = list.children[1];
    const c = list.children[2];

    const reconciler = new DOMReconciler();

    reconciler.apply(root, 'div>ul>li[data-key="c"]{C}+li[data-key="a"]{A}+li[data-key="b"]{B}');

    expect(list.children[0]).toBe(c);
    expect(list.children[1]).toBe(a);
    expect(list.children[2]).toBe(b);
  });

  it('is idempotent for an unchanged tree', () => {
    const root = document.createElement('div');
    const reconciler = new DOMReconciler();

    const abbreviation = 'div>h1{Hello}+p{World}';

    reconciler.apply(root, abbreviation);

    const heading = root.querySelector('h1');
    const paragraph = root.querySelector('p');

    const result = reconciler.apply(root, abbreviation);

    expect(root.querySelector('h1')).toBe(heading);
    expect(root.querySelector('p')).toBe(paragraph);
    expect(result.mutations).toHaveLength(0);
  });
});
