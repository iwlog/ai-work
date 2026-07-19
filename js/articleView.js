/**
 * 記事一覧・詳細表示のための表示変換ロジック（Phase 4B-2）。
 * DOM操作を含まない純粋関数のみをここにまとめ、node:testから検証できるようにする。
 * ブラウザ・Node両方から読み込めるよう、UMD相当の簡易な形にしている。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LineLifeLogArticleView = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** ISO日時文字列を "2026年7月19日" 形式に整形する。不正な値はそのまま返す。 */
  function formatArticleDate(isoString) {
    if (typeof isoString !== 'string' || isoString.trim() === '') return '';
    var date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  /** 一覧カード用に、抜粋(excerpt)が空ならbodyの冒頭から生成する。 */
  function resolveListSummary(article, maxLength) {
    var limit = typeof maxLength === 'number' ? maxLength : 80;
    var excerpt = article && typeof article.excerpt === 'string' ? article.excerpt.trim() : '';
    if (excerpt !== '') return excerpt;
    var body = article && typeof article.body === 'string' ? article.body.trim() : '';
    if (body === '') return '';
    return body.length > limit ? body.slice(0, limit) + '…' : body;
  }

  /** publishedAt降順で記事を並べ替えた新しい配列を返す（元の配列は変更しない）。 */
  function sortArticlesByPublishedAtDesc(articles) {
    var list = Array.isArray(articles) ? articles.slice() : [];
    return list.sort(function (a, b) {
      var da = new Date(a && a.publishedAt).getTime();
      var db = new Date(b && b.publishedAt).getTime();
      var ta = Number.isNaN(da) ? 0 : da;
      var tb = Number.isNaN(db) ? 0 : db;
      return tb - ta;
    });
  }

  /** slugに一致する記事を配列から探す。見つからなければnull。 */
  function findArticleBySlug(articles, slug) {
    if (!Array.isArray(articles) || typeof slug !== 'string' || slug === '') return null;
    var found = articles.filter(function (a) {
      return a && a.slug === slug;
    })[0];
    return found || null;
  }

  /** URLの?slug=パラメータを取り出す（純粋関数。呼び出し側でsearch文字列を渡す）。 */
  function extractSlugFromSearch(search) {
    var params = new URLSearchParams(typeof search === 'string' ? search : '');
    var slug = params.get('slug');
    return slug && slug.trim() !== '' ? slug.trim() : null;
  }

  /**
   * 現在のURLに?api=(API接続先の一時上書き)が付いている場合、一覧・詳細間の遷移でも
   * それを引き継いだURLを組み立てる（さもないと詳細ページへ移動した瞬間に上書きが失われ、
   * ローカル確認用のURLが本番設定に戻ってしまう）。
   */
  function buildArticlesPageUrl(currentSearch, slug) {
    var currentParams = new URLSearchParams(typeof currentSearch === 'string' ? currentSearch : '');
    var apiOverride = currentParams.get('api');
    var target = new URLSearchParams();
    if (slug) target.set('slug', slug);
    if (apiOverride) target.set('api', apiOverride);
    var query = target.toString();
    return 'articles.html' + (query ? '?' + query : '');
  }

  /** エラーのcodeから、ユーザー向けの分かりやすいメッセージへ変換する。 */
  function describeArticlesError(error) {
    var code = error && error.code;
    switch (code) {
      case 'CONFIG_MISSING':
        return 'API接続先が設定されていません。js/config.js の API_BASE_URL を設定してください。';
      case 'NO_FETCH':
        return 'このブラウザではfetch APIが利用できません。';
      case 'NETWORK_ERROR':
        return '記事の取得に失敗しました（通信エラー）。ネットワーク状況やAPIの起動状態を確認してください。';
      case 'HTTP_ERROR':
        return '記事の取得に失敗しました（APIエラー: status ' + (error && error.status) + '）。';
      case 'INVALID_RESPONSE':
        return '記事の取得に失敗しました（APIの応答形式が不正です）。';
      default:
        return '記事の取得に失敗しました。時間をおいて再度お試しください。';
    }
  }

  return {
    formatArticleDate: formatArticleDate,
    resolveListSummary: resolveListSummary,
    sortArticlesByPublishedAtDesc: sortArticlesByPublishedAtDesc,
    findArticleBySlug: findArticleBySlug,
    extractSlugFromSearch: extractSlugFromSearch,
    buildArticlesPageUrl: buildArticlesPageUrl,
    describeArticlesError: describeArticlesError,
  };
});
