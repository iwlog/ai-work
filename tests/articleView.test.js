const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatArticleDate,
  resolveListSummary,
  sortArticlesByPublishedAtDesc,
  findArticleBySlug,
  extractSlugFromSearch,
  buildArticlesPageUrl,
  describeArticlesError,
} = require('../js/articleView.js');

test('formatArticleDate: ISO日時を日本語形式に整形する', () => {
  assert.equal(formatArticleDate('2026-07-19T09:00:00.000Z'), '2026年7月19日');
});

test('formatArticleDate: 不正な値はそのまま返す', () => {
  assert.equal(formatArticleDate('not-a-date'), 'not-a-date');
  assert.equal(formatArticleDate(''), '');
});

test('resolveListSummary: excerptがあればそれを使う', () => {
  const summary = resolveListSummary({ excerpt: '抜粋テキスト', body: '本文' });
  assert.equal(summary, '抜粋テキスト');
});

test('resolveListSummary: excerptが空ならbodyから生成し、上限を超えたら省略記号を付ける', () => {
  const summary = resolveListSummary({ excerpt: '', body: 'あ'.repeat(100) }, 10);
  assert.equal(summary, 'あ'.repeat(10) + '…');
});

test('sortArticlesByPublishedAtDesc: publishedAt降順に並べ替え、元配列は変更しない', () => {
  const articles = [
    { id: 'old', publishedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'new', publishedAt: '2026-07-01T00:00:00.000Z' },
  ];
  const sorted = sortArticlesByPublishedAtDesc(articles);
  assert.deepEqual(sorted.map((a) => a.id), ['new', 'old']);
  assert.equal(articles[0].id, 'old');
});

test('findArticleBySlug: 一致する記事を返し、無ければnull', () => {
  const articles = [{ slug: 'a', id: '1' }, { slug: 'b', id: '2' }];
  assert.deepEqual(findArticleBySlug(articles, 'b'), { slug: 'b', id: '2' });
  assert.equal(findArticleBySlug(articles, 'not-found'), null);
});

test('extractSlugFromSearch: ?slug=の値を取り出す', () => {
  assert.equal(extractSlugFromSearch('?slug=my-article'), 'my-article');
  assert.equal(extractSlugFromSearch(''), null);
  assert.equal(extractSlugFromSearch('?other=1'), null);
});

test('buildArticlesPageUrl: slug指定時は詳細ページのURLを組み立てる', () => {
  assert.equal(buildArticlesPageUrl('', 'my-slug'), 'articles.html?slug=my-slug');
});

test('buildArticlesPageUrl: slug未指定時は一覧ページのURLを組み立てる', () => {
  assert.equal(buildArticlesPageUrl('', null), 'articles.html');
});

test('buildArticlesPageUrl: ?apiの一時上書きを引き継ぐ（一覧⇔詳細間で失われない）', () => {
  assert.equal(
    buildArticlesPageUrl('?api=http://localhost:3000', 'my-slug'),
    'articles.html?slug=my-slug&api=http%3A%2F%2Flocalhost%3A3000',
  );
  assert.equal(
    buildArticlesPageUrl('?api=http://localhost:3000', null),
    'articles.html?api=http%3A%2F%2Flocalhost%3A3000',
  );
});

test('describeArticlesError: エラーコードごとに分かりやすいメッセージへ変換する', () => {
  assert.match(describeArticlesError({ code: 'CONFIG_MISSING' }), /設定されていません/);
  assert.match(describeArticlesError({ code: 'NETWORK_ERROR' }), /通信エラー/);
  assert.match(describeArticlesError({ code: 'HTTP_ERROR', status: 500 }), /500/);
  assert.match(describeArticlesError({ code: 'INVALID_RESPONSE' }), /応答形式/);
  assert.match(describeArticlesError({}), /取得に失敗/);
});
