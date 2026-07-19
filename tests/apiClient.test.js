const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getConfiguredApiBaseUrl,
  buildArticlesUrl,
  isValidArticlesResponse,
  fetchPublicArticles,
} = require('../js/api-client.js');

test('buildArticlesUrl: ベースURLから記事一覧APIのURLを組み立てる', () => {
  assert.equal(buildArticlesUrl('http://localhost:3000'), 'http://localhost:3000/api/public/articles');
});

test('buildArticlesUrl: 末尾のスラッシュは重複しない', () => {
  assert.equal(buildArticlesUrl('http://localhost:3000/'), 'http://localhost:3000/api/public/articles');
});

test('buildArticlesUrl: 未設定(null/空文字)ならnullを返す', () => {
  assert.equal(buildArticlesUrl(null), null);
  assert.equal(buildArticlesUrl(''), null);
  assert.equal(buildArticlesUrl('   '), null);
});

test('isValidArticlesResponse: articlesが配列であるレスポンスのみ有効', () => {
  assert.equal(isValidArticlesResponse({ articles: [] }), true);
  assert.equal(isValidArticlesResponse({ articles: [{ id: '1' }] }), true);
  assert.equal(isValidArticlesResponse({}), false);
  assert.equal(isValidArticlesResponse({ articles: 'not-an-array' }), false);
  assert.equal(isValidArticlesResponse(null), false);
});

test('getConfiguredApiBaseUrl: クエリパラメータ?apiが設定より優先される', () => {
  const url = getConfiguredApiBaseUrl(
    { search: '?api=http://localhost:9999' },
    { API_BASE_URL: 'https://example.com' },
  );
  assert.equal(url, 'http://localhost:9999');
});

test('getConfiguredApiBaseUrl: クエリパラメータが無ければconfigの値を使う', () => {
  const url = getConfiguredApiBaseUrl({ search: '' }, { API_BASE_URL: 'https://example.com/' });
  assert.equal(url, 'https://example.com');
});

test('getConfiguredApiBaseUrl: どちらも未設定ならnullを返す', () => {
  const url = getConfiguredApiBaseUrl({ search: '' }, { API_BASE_URL: '' });
  assert.equal(url, null);
});

test('fetchPublicArticles: ベースURL未設定はCONFIG_MISSINGエラーになる', async () => {
  await assert.rejects(() => fetchPublicArticles(null, async () => {}), (err) => {
    assert.equal(err.code, 'CONFIG_MISSING');
    return true;
  });
});

test('fetchPublicArticles: 正常応答時はarticles配列を返す', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ articles: [{ id: 'a1', title: 'テスト記事' }] }),
  });
  const articles = await fetchPublicArticles('http://localhost:3000', fakeFetch);
  assert.deepEqual(articles, [{ id: 'a1', title: 'テスト記事' }]);
});

test('fetchPublicArticles: HTTPエラー応答はHTTP_ERRORになる', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => fetchPublicArticles('http://localhost:3000', fakeFetch), (err) => {
    assert.equal(err.code, 'HTTP_ERROR');
    assert.equal(err.status, 500);
    return true;
  });
});

test('fetchPublicArticles: fetch自体が失敗した場合はNETWORK_ERRORになる', async () => {
  const fakeFetch = async () => {
    throw new Error('接続できません');
  };
  await assert.rejects(() => fetchPublicArticles('http://localhost:3000', fakeFetch), (err) => {
    assert.equal(err.code, 'NETWORK_ERROR');
    return true;
  });
});

test('fetchPublicArticles: 応答形式が不正な場合はINVALID_RESPONSEになる', async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ notArticles: true }) });
  await assert.rejects(() => fetchPublicArticles('http://localhost:3000', fakeFetch), (err) => {
    assert.equal(err.code, 'INVALID_RESPONSE');
    return true;
  });
});
