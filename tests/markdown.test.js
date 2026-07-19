const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeHttpUrl, parseInline, parseBlocks } = require('../js/markdown.js');

test('isSafeHttpUrl: httpとhttpsのみ許可する', () => {
  assert.equal(isSafeHttpUrl('https://example.com'), true);
  assert.equal(isSafeHttpUrl('http://example.com'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl(''), false);
  assert.equal(isSafeHttpUrl(null), false);
});

test('parseInline: 太字・斜体・リンクをトークン化する', () => {
  const tokens = parseInline('これは**太字**と*斜体*と[リンク](https://example.com)です');
  assert.deepEqual(
    tokens.map((t) => t.type),
    ['text', 'strong', 'text', 'em', 'text', 'link', 'text'],
  );
  const linkToken = tokens.find((t) => t.type === 'link');
  assert.equal(linkToken.safe, true);
  assert.equal(linkToken.url, 'https://example.com');
});

test('parseInline: 安全でないURLのリンクはsafe:falseになる', () => {
  const tokens = parseInline('[危険](javascript:alert(1))');
  const linkToken = tokens.find((t) => t.type === 'link');
  assert.equal(linkToken.safe, false);
});

test('parseInline: HTMLタグを含む文字列はただのテキストトークンとして扱われる（HTML解釈しない）', () => {
  const tokens = parseInline('<script>alert(1)</script>');
  assert.deepEqual(tokens, [{ type: 'text', value: '<script>alert(1)</script>' }]);
});

test('parseBlocks: 見出し・箇条書き・段落をブロックに分解する', () => {
  const blocks = parseBlocks('## 見出し\n\n本文1行目\n本文2行目\n\n- 項目1\n- 項目2');
  assert.deepEqual(blocks, [
    { type: 'heading', level: 2, text: '見出し' },
    { type: 'paragraph', lines: ['本文1行目', '本文2行目'] },
    { type: 'list', items: ['項目1', '項目2'] },
  ]);
});

test('parseBlocks: 空文字列は空配列を返す', () => {
  assert.deepEqual(parseBlocks(''), []);
  assert.deepEqual(parseBlocks(null), []);
});
