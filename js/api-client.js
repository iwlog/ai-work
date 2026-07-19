/**
 * line-life-logの公開記事API(GET /api/public/articles)を読み取るためのクライアント（Phase 4B-1）。
 * 認証情報は一切扱わない（対象APIが認証不要の読み取り専用エンドポイントであるため）。
 * 元ログ・管理用API（/admin/*）には一切アクセスしない。
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

  /**
   * API接続先(ベースURL)を決定する。優先順位:
   * 1. URLクエリパラメータ ?api=... （ローカル確認用の一時上書き。コミット対象には残らない）
   * 2. js/config.js の window.LINE_LIFE_LOG_CONFIG.API_BASE_URL
   * どちらも未設定・空文字の場合はnullを返す（呼び出し側で「未設定」エラーを表示する）。
   */
  function getConfiguredApiBaseUrl(locationLike, configLike) {
    var loc = locationLike || (typeof window !== 'undefined' ? window.location : null);
    if (loc && typeof loc.search === 'string') {
      var params = new URLSearchParams(loc.search);
      var override = params.get('api');
      if (override && override.trim() !== '') {
        return stripTrailingSlash(override.trim());
      }
    }

    var config = configLike || (typeof window !== 'undefined' ? window.LINE_LIFE_LOG_CONFIG : null);
    if (config && typeof config.API_BASE_URL === 'string' && config.API_BASE_URL.trim() !== '') {
      return stripTrailingSlash(config.API_BASE_URL.trim());
    }
    return null;
  }

  function stripTrailingSlash(url) {
    return url.replace(/\/+$/, '');
  }

  /** ベースURLから記事一覧APIの完全なURLを組み立てる（純粋関数）。 */
  function buildArticlesUrl(baseUrl) {
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      return null;
    }
    return stripTrailingSlash(baseUrl) + '/api/public/articles';
  }

  /**
   * APIレスポンスの形状を検証する（純粋関数）。想定外の形式を「取得成功」として
   * 扱わないようにするための最低限のガード。
   */
  function isValidArticlesResponse(data) {
    return !!data && Array.isArray(data.articles);
  }

  /**
   * 記事一覧を取得する。設定未済み・通信失敗・不正な応答形式はいずれも例外として投げ、
   * 呼び出し側(articles.js)で種類ごとに分かりやすいメッセージへ変換する。
   */
  async function fetchPublicArticles(baseUrl, fetchImpl) {
    var url = buildArticlesUrl(baseUrl);
    if (!url) {
      var configError = new Error('API接続先が設定されていません');
      configError.code = 'CONFIG_MISSING';
      throw configError;
    }

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

    if (!res.ok) {
      var httpError = new Error('APIがエラーを返しました (status: ' + res.status + ')');
      httpError.code = 'HTTP_ERROR';
      httpError.status = res.status;
      throw httpError;
    }

    var data = await res.json();
    if (!isValidArticlesResponse(data)) {
      var invalidError = new Error('APIの応答形式が不正です');
      invalidError.code = 'INVALID_RESPONSE';
      throw invalidError;
    }
    return data.articles;
  }

  return {
    getConfiguredApiBaseUrl: getConfiguredApiBaseUrl,
    buildArticlesUrl: buildArticlesUrl,
    isValidArticlesResponse: isValidArticlesResponse,
    fetchPublicArticles: fetchPublicArticles,
  };
});
