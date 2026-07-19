/**
 * 記事データの取得元を決定し、取得するクライアント（Phase 4B-1で新設、Phase 4Cで静的JSON対応）。
 * 認証情報は一切扱わない。元ログ・管理用API（/admin/*）には一切アクセスしない。
 *
 * 取得優先順位（Phase 4C）:
 *   1. URLに ?api=<URL> が指定されている場合 → line-life-logのGET /api/public/articlesから取得
 *      （ローカルでのdevサーバー・ngrok確認用。?api=はコミット対象に残らない一時上書き）
 *   2. 指定が無い場合 → 同梱の静的ファイル(既定: ./data/articles.json)から取得
 *      （GitHub Pagesでの本番運用時はこちらが既定経路になり、line-life-logやngrokが
 *      停止していても記事を表示できる）
 * ?api=が指定されているのに形式が不正な場合は、静的JSONへ黙ってフォールバックせず、
 * 明確なエラーとして扱う（意図と異なるデータを見て気付かないままになることを防ぐため）。
 *
 * ブラウザ・Node(node:test)の両方から読み込めるよう、UMD相当の簡易な形にしている
 * （ai-workにはビルドツールを導入しないため、この形を採用する）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LineLifeLogApiClient = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function stripTrailingSlash(url) {
    return url.replace(/\/+$/, '');
  }

  /**
   * URLの?apiパラメータを取り出す（純粋関数）。未指定・空文字はどちらもnull扱いにする
   * （「指定されていない」という1つの状態として扱うため）。
   */
  function resolveApiOverride(search) {
    var params = new URLSearchParams(typeof search === 'string' ? search : '');
    var raw = params.get('api');
    if (raw === null) return null;
    var trimmed = raw.trim();
    return trimmed === '' ? null : stripTrailingSlash(trimmed);
  }

  /** http/https形式の絶対URLかどうかを判定する（純粋関数）。 */
  function isValidHttpUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') return false;
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /** ベースURLから記事一覧APIの完全なURLを組み立てる（純粋関数）。 */
  function buildArticlesUrl(baseUrl) {
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      return null;
    }
    return stripTrailingSlash(baseUrl) + '/api/public/articles';
  }

  /**
   * レスポンスの形状を検証する（純粋関数）。想定外の形式を「取得成功」として
   * 扱わないようにするための最低限のガード。
   */
  function isValidArticlesResponse(data) {
    return !!data && Array.isArray(data.articles);
  }

  async function parseArticlesResponse(res) {
    if (!res.ok) {
      var httpError = new Error('記事データの取得に失敗しました (status: ' + res.status + ')');
      httpError.code = 'HTTP_ERROR';
      httpError.status = res.status;
      throw httpError;
    }

    var data;
    try {
      data = await res.json();
    } catch (err) {
      var parseError = new Error('応答がJSON形式ではありません');
      parseError.code = 'INVALID_RESPONSE';
      parseError.cause = err;
      throw parseError;
    }

    if (!isValidArticlesResponse(data)) {
      var invalidError = new Error('応答の形式が不正です');
      invalidError.code = 'INVALID_RESPONSE';
      throw invalidError;
    }
    return data.articles;
  }

  async function fetchFromUrl(url, fetchImpl) {
    var doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!doFetch) {
      var noFetchError = new Error('fetch APIが利用できません');
      noFetchError.code = 'NO_FETCH';
      throw noFetchError;
    }

    var res;
    try {
      res = await doFetch(url);
    } catch (err) {
      var networkError = new Error('通信に失敗しました');
      networkError.code = 'NETWORK_ERROR';
      networkError.cause = err;
      throw networkError;
    }

    return parseArticlesResponse(res);
  }

  /**
   * line-life-logのGET /api/public/articlesから記事一覧を取得する。
   * baseUrlが未指定・空の場合はCONFIG_MISSINGを投げる（loadArticles経由の通常フローでは
   * 到達しない防御的なガード。直接このAPIを呼ぶ場合のためのもの）。
   */
  async function fetchPublicArticles(baseUrl, fetchImpl) {
    var url = buildArticlesUrl(baseUrl);
    if (!url) {
      var configError = new Error('API接続先が設定されていません');
      configError.code = 'CONFIG_MISSING';
      throw configError;
    }
    return fetchFromUrl(url, fetchImpl);
  }

  /** 同梱の静的JSON(既定: ./data/articles.json)から記事一覧を取得する。 */
  async function fetchStaticArticles(staticPath, fetchImpl) {
    var target =
      typeof staticPath === 'string' && staticPath.trim() !== '' ? staticPath.trim() : './data/articles.json';
    return fetchFromUrl(target, fetchImpl);
  }

  /**
   * 取得元を決定したうえで記事一覧を取得する（Phase 4Cのエントリーポイント）。
   * 戻り値には実際に使われた取得元(source: 'api' | 'static')も含める（画面表示や
   * デバッグ確認に使えるようにするため。現状のUIでは必須ではないが害もない）。
   */
  async function loadArticles(options) {
    var opts = options || {};
    var override = resolveApiOverride(opts.search);

    if (override !== null) {
      if (!isValidHttpUrl(override)) {
        var invalidUrlError = new Error('指定されたAPI接続先(?api=)の形式が不正です');
        invalidUrlError.code = 'INVALID_API_URL';
        throw invalidUrlError;
      }
      var apiArticles = await fetchPublicArticles(override, opts.fetchImpl);
      return { articles: apiArticles, source: 'api', baseUrl: override };
    }

    var staticArticles = await fetchStaticArticles(opts.staticPath, opts.fetchImpl);
    return { articles: staticArticles, source: 'static' };
  }

  return {
    resolveApiOverride: resolveApiOverride,
    isValidHttpUrl: isValidHttpUrl,
    buildArticlesUrl: buildArticlesUrl,
    isValidArticlesResponse: isValidArticlesResponse,
    fetchPublicArticles: fetchPublicArticles,
    fetchStaticArticles: fetchStaticArticles,
    loadArticles: loadArticles,
  };
});
