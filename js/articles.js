/**
 * 記事一覧・詳細ページ(articles.html)のDOM制御（Phase 4B-2）。
 * API取得(api-client.js)・表示変換(articleView.js)・安全なMarkdown描画(markdown.js)を
 * このページの実際のDOM要素に結び付ける役割のみを持つ（ロジック本体はそれぞれの純粋関数側にある）。
 *
 * 一覧はarticles.html、詳細はarticles.html?slug=... という単一ページ構成にしている
 * （GitHub Pagesは静的ホスティングのためサーバー側ルーティングがなく、クエリパラメータで
 * 状態を切り替える方式が最小の変更で済むため）。
 */
document.addEventListener('DOMContentLoaded', function () {
  var apiClient = window.LineLifeLogApiClient;
  var articleView = window.LineLifeLogArticleView;
  var markdown = window.LineLifeLogMarkdown;

  var statusEl = document.getElementById('articles-status');
  var listEl = document.getElementById('articles-list');
  var detailEl = document.getElementById('article-detail');
  var titleEl = document.getElementById('articles-title');
  var subtitleEl = document.getElementById('articles-subtitle');
  var detailTitleEl = document.getElementById('article-detail-title');
  var detailMetaEl = document.getElementById('article-detail-meta');
  var detailBodyEl = document.getElementById('article-detail-body');
  var backLinkEl = detailEl.querySelector('.article-back-link');

  function updateBackLink() {
    // ?api=での一時上書き中でも、一覧に戻った際に上書きが失われないようにする
    backLinkEl.href = articleView.buildArticlesPageUrl(window.location.search, null);
  }

  function showStatus(message) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('hidden', !message);
  }

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderList(articles) {
    var sorted = articleView.sortArticlesByPublishedAtDesc(articles);
    clearChildren(listEl);

    if (sorted.length === 0) {
      showStatus('公開されている記事はまだありません。');
      listEl.classList.add('hidden');
      return;
    }

    showStatus(null);
    sorted.forEach(function (article) {
      var card = document.createElement('a');
      card.className = 'article-card';
      card.href = articleView.buildArticlesPageUrl(window.location.search, article.slug);

      var meta = document.createElement('div');
      meta.className = 'article-card-meta';
      var dateSpan = document.createElement('span');
      dateSpan.className = 'date';
      dateSpan.textContent = articleView.formatArticleDate(article.publishedAt);
      meta.appendChild(dateSpan);
      if (article.category) {
        var categorySpan = document.createElement('span');
        categorySpan.className = 'article-card-category';
        categorySpan.textContent = article.category;
        meta.appendChild(categorySpan);
      }
      card.appendChild(meta);

      var titleH3 = document.createElement('h3');
      titleH3.textContent = article.title;
      card.appendChild(titleH3);

      var summary = articleView.resolveListSummary(article, 90);
      if (summary) {
        var summaryP = document.createElement('p');
        summaryP.textContent = summary;
        card.appendChild(summaryP);
      }

      listEl.appendChild(card);
    });
    listEl.classList.remove('hidden');
  }

  function renderDetail(article) {
    updateBackLink();
    titleEl.textContent = article.title;
    subtitleEl.textContent = '';

    detailTitleEl.textContent = article.title;

    var metaParts = [];
    var dateText = articleView.formatArticleDate(article.publishedAt);
    if (dateText) metaParts.push(dateText);
    if (article.category) metaParts.push(article.category);
    detailMetaEl.textContent = metaParts.join(' ・ ');

    clearChildren(detailBodyEl);
    detailBodyEl.appendChild(markdown.renderMarkdownToFragment(article.body || ''));

    if (Array.isArray(article.tags) && article.tags.length > 0) {
      var tagsRow = document.createElement('div');
      tagsRow.className = 'article-detail-tags';
      article.tags.forEach(function (tag) {
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsRow.appendChild(tagSpan);
      });
      detailBodyEl.appendChild(tagsRow);
    }

    showStatus(null);
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');
  }

  function renderDetailNotFound() {
    updateBackLink();
    showStatus(null);
    listEl.classList.add('hidden');
    titleEl.textContent = '記事が見つかりません';
    subtitleEl.textContent = '';
    detailTitleEl.textContent = '';
    detailMetaEl.textContent = '';
    clearChildren(detailBodyEl);
    var message = document.createElement('p');
    message.textContent = '指定された記事が見つかりませんでした。公開が停止された可能性があります。';
    detailBodyEl.appendChild(message);
    detailEl.classList.remove('hidden');
  }

  async function main() {
    var slug = articleView.extractSlugFromSearch(window.location.search);
    showStatus('読み込み中です…');

    try {
      var result = await apiClient.loadArticles({ search: window.location.search });
      var articles = result.articles;
      if (slug) {
        var found = articleView.findArticleBySlug(articles, slug);
        if (found) {
          renderDetail(found);
        } else {
          renderDetailNotFound();
        }
      } else {
        renderList(articles);
      }
    } catch (err) {
      showStatus(articleView.describeArticlesError(err));
      listEl.classList.add('hidden');
      detailEl.classList.add('hidden');
    }
  }

  main();
});
