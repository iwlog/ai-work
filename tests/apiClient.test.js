const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveApiOverride,
  isValidHttpUrl,
  buildArticlesUrl,
  isValidArticlesResponse,
  fetchPublicArticles,
  fetchStaticArticles,
  loadArticles,
} = require('../js/api-client.js');

test('resolveApiOverride: ?apiの値を取り出す', () => {
  assert.equal(resolveApiOverride('?api=http://localhost:3000'), 'http://localhost:3000');
});

test('resolveApiOverride: 末尾のスラッシュを除去する', () => {
  assert.equal(resolveApiOverride('?api=http://localhost:3000/'), 'http://localhost:3000');
});

test('resolveApiOverride: 未指定・空文字はどちらもnullを返す', () => {
  assert.equal(resolveApiOverride(''), null);
  assert.equal(resolveApiOverride('?api='), null);
  assert.equal(resolveApiOverride('?other=1'), null);
});

test('isValidHttpUrl: httpとhttpsのみ有効', () => {
  assert.equal(isValidHttpUrl('https://example.com'), true);
  assert.equal(isValidHttpUrl('http://localhost:3000'), true);
  assert.equal(isValidHttpUrl('not a url'), false);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl(null), false);
});

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

test('fetchPublicArticles: JSONとして解析できない応答はINVALID_RESPONSEになる', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });
  await assert.rejects(() => fetchPublicArticles('http://localhost:3000', fakeFetch), (err) => {
    assert.equal(err.code, 'INVALID_RESPONSE');
    return true;
  });
});

test('fetchStaticArticles: 既定パスは./data/articles.jsonを使う', async () => {
  let requestedUrl = null;
  const fakeFetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ articles: [] }) };
  };
  await fetchStaticArticles(undefined, fakeFetch);
  assert.equal(requestedUrl, './data/articles.json');
});

test('fetchStaticArticles: 指定したパスをそのまま使う', async () => {
  let requestedUrl = null;
  const fakeFetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ articles: [] }) };
  };
  await fetchStaticArticles('./custom/path.json', fakeFetch);
  assert.equal(requestedUrl, './custom/path.json');
});

test('fetchStaticArticles: 存在しない(404)場合はHTTP_ERRORになる', async () => {
  const fakeFetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => fetchStaticArticles(undefined, fakeFetch), (err) => {
    assert.equal(err.code, 'HTTP_ERROR');
    assert.equal(err.status, 404);
    return true;
  });
});

test('loadArticles: ?api=が無い場合は静的JSONから取得する(source:"static")', async () => {
  let requestedUrl = null;
  const fakeFetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ articles: [{ id: 's1' }] }) };
  };
  const result = await loadArticles({ search: '', fetchImpl: fakeFetch });
  assert.equal(result.source, 'static');
  assert.deepEqual(result.articles, [{ id: 's1' }]);
  assert.equal(requestedUrl, './data/articles.json');
});

test('loadArticles: ?api=がある場合はAPIから取得する(source:"api")、静的JSONへは要求しない', async () => {
  let requestedUrl = null;
  const fakeFetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ articles: [{ id: 'a1' }] }) };
  };
  const result = await loadArticles({ search: '?api=http://localhost:3000', fetchImpl: fakeFetch });
  assert.equal(result.source, 'api');
  assert.equal(result.baseUrl, 'http://localhost:3000');
  assert.deepEqual(result.articles, [{ id: 'a1' }]);
  assert.equal(requestedUrl, 'http://localhost:3000/api/public/articles');
});

test('loadArticles: ?api=の値が不正なURLの場合はINVALID_API_URLになり、静的JSONへフォールバックしない', async () => {
  let fetchCalled = false;
  const fakeFetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200, json: async () => ({ articles: [] }) };
  };
  await assert.rejects(
    () => loadArticles({ search: '?api=not-a-valid-url', fetchImpl: fakeFetch }),
    (err) => {
      assert.equal(err.code, 'INVALID_API_URL');
      return true;
    },
  );
  assert.equal(fetchCalled, false);
});
