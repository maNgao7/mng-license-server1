'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual viewer script with a small DOM, including its fetch/render
// path. Image errors are driven explicitly; no public CDN requests are made.
class Node {
  children = []; dataset = {}; style = {}; textContent = ''; removed = false;
  constructor(tag) { this.tag = tag; }
  get childElementCount() { return this.children.length; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  remove() { this.removed = true; }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
const script = fs.readFileSync(path.join(__dirname, '../src/widgets/view.html'), 'utf8').match(/<script>([\s\S]+)<\/script>/)[1];

for (const kind of ['fighters', 'queue', 'winners']) {
  test(kind + ' viewer tries the next portrait and preserves the identity when every image fails', async () => {
    const main = new Node('main'); main.dataset.kind = kind;
    const nodes = Object.fromEntries(['rows', 'total', 'status'].map(id => [id, new Node('div')]));
    const portrait = '../gift-assets/portrait-11111111-2222-3333-4444-555555555555.png';
    const person = { name: 'İpek', handle: 'ipek', portrait, portraitAlternatives: ['https://p16.ibyteimg.com/fallback.jpg'], coins: 7, wins: 2 };
    const data = kind === 'fighters' ? { rows: [{ side: 'left', fighter: person, hp: 80 }], revision: 'test' }
      : kind === 'queue' ? { rows: [person], total: 1, revision: 'test' }
      : { rows: [], champion: person, revision: 'test' };
    vm.runInNewContext(script, { document: { querySelector: () => main, getElementById: id => nodes[id],
      createElement: tag => new Node(tag), createDocumentFragment: () => new Node('fragment') },
      location: { href: 'https://tickmng.com/overlays/' + 'q'.repeat(43) + '/widget/view/hediye-box-' + kind },
      URL, Intl, AbortSignal, fetch: async () => Response.json(data), setTimeout() {} });
    await new Promise(resolve => setImmediate(resolve));
    const all = descendants(nodes.rows), img = all.find(node => node.tag === 'img');
    assert.ok(img); assert.equal(img.src, portrait); assert.equal(img.referrerPolicy, 'no-referrer');
    img.onerror(); assert.equal(img.src, person.portraitAlternatives[0]); assert.equal(img.removed, false);
    img.onerror(); assert.equal(img.removed, true);
    assert.ok(all.some(node => node.className === 'name' && node.textContent === 'İpek'));
    assert.ok(all.some(node => node.className === 'photo' && node.textContent === 'İ'));
  });
}
