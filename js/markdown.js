/**
 * line-life-logの公開記事本文(Markdown原文)を安全に画面へ描画するための最小限のレンダラー
 * （Phase 4B-2）。line-life-log側(src/utils/markdown.ts)と同じ安全設計方針を踏襲する。
 *
 * - 見出し(シャープ記号)・箇条書き(ハイフンやアスタリスク)・強調(アスタリスク2つで太字、1つで斜体)・
 *   リンク([text](url))・段落のみを解釈する
 * - 対応外の記法は全て「ただの文字列」としてtextContent経由でそのまま表示する（HTML解釈しない）
 * - innerHTMLは一切使用しない。DOM要素はcreateElement、テキストは必ずtextContent/
 *   createTextNodeで挿入するため、本文に<script>等が含まれていてもタグとして解釈されない
 * - リンクはhttp/https以外（javascript:等）を弾いてから初めて<a>要素のhrefに設定する
 *
 * ブラウザ・Node(node:test)の両方から読み込めるよう、UMD相当の簡易な形にしている。
 * パース系の純粋関数(parseBlocks/parseInline/isSafeHttpUrl)はNode側のテストからも直接呼べる。
 * DOM生成系(renderMarkdownToFragment等)はブラウザでのみ動作する（呼び出し時にdocumentを使うため）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LineLifeLogMarkdown = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
  var BULLET_PATTERN = /^[-*]\s+/;
  var LINK_PATTERN = /\[([^[\]]*)\]\((\S+?)\)/g;
  var BOLD_OR_ITALIC_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

  /** http/https以外(javascript:, data:等)のURLを弾く。line-life-logのisSafeHttpUrlと同じ方針。 */
  function isSafeHttpUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') return false;
    try {
      var parsed = new URL(url, 'https://dummy-base.invalid/');
      // 相対URLだった場合base側が使われてしまうと誤って安全判定してしまうため、
      // 明示的にhttp/https始まりの絶対URLのみを許可する。
      if (!/^https?:\/\//i.test(url.trim())) return false;
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * 1行分のインラインテキストを「リンク／太字／斜体／プレーンテキスト」のトークン列に分解する
   * （純粋関数）。ここでは文字列としてのトークン化のみ行い、DOM生成は行わない。
   */
  function parseInline(text) {
    var input = String(text || '');
    var tokens = [];
    var segments = [];
    var lastIndex = 0;
    var match;

    LINK_PATTERN.lastIndex = 0;
    while ((match = LINK_PATTERN.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'plain', value: input.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'link', text: match[1], url: match[2] });
      lastIndex = LINK_PATTERN.lastIndex;
    }
    if (lastIndex < input.length) {
      segments.push({ type: 'plain', value: input.slice(lastIndex) });
    }

    segments.forEach(function (seg) {
      if (seg.type === 'link') {
        tokens.push({ type: 'link', text: seg.text, url: seg.url, safe: isSafeHttpUrl(seg.url) });
        return;
      }
      var parts = seg.value.split(BOLD_OR_ITALIC_PATTERN).filter(function (p) {
        return p !== '';
      });
      parts.forEach(function (part) {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          tokens.push({ type: 'strong', value: part.slice(2, -2) });
        } else if (/^\*[^*]+\*$/.test(part)) {
          tokens.push({ type: 'em', value: part.slice(1, -1) });
        } else {
          tokens.push({ type: 'text', value: part });
        }
      });
    });

    return tokens;
  }

  /**
   * Markdown全文を「見出し／箇条書き／段落」のブロック列に分解する（純粋関数）。
   * line-life-log側(renderMarkdownToSafeHtml)と同じ行単位の状態遷移ロジック。
   */
  function parseBlocks(markdown) {
    var lines = String(markdown || '')
      .replace(/\r\n?/g, '\n')
      .split('\n');
    var blocks = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i] || '';
      if (line.trim() === '') {
        i++;
        continue;
      }

      var headingMatch = HEADING_PATTERN.exec(line);
      if (headingMatch) {
        blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() });
        i++;
        continue;
      }

      if (BULLET_PATTERN.test(line)) {
        var items = [];
        while (i < lines.length && BULLET_PATTERN.test(lines[i] || '')) {
          items.push((lines[i] || '').replace(BULLET_PATTERN, ''));
          i++;
        }
        blocks.push({ type: 'list', items: items });
        continue;
      }

      var paraLines = [];
      while (
        i < lines.length &&
        (lines[i] || '').trim() !== '' &&
        !HEADING_PATTERN.test(lines[i] || '') &&
        !BULLET_PATTERN.test(lines[i] || '')
      ) {
        paraLines.push(lines[i] || '');
        i++;
      }
      blocks.push({ type: 'paragraph', lines: paraLines });
    }

    return blocks;
  }

  /** インライントークン列をDOMノード列へ変換する。innerHTMLは使わない。 */
  function inlineTokensToNodes(tokens) {
    return tokens.map(function (token) {
      if (token.type === 'strong') {
        var strong = document.createElement('strong');
        strong.textContent = token.value;
        return strong;
      }
      if (token.type === 'em') {
        var em = document.createElement('em');
        em.textContent = token.value;
        return em;
      }
      if (token.type === 'link') {
        if (token.safe) {
          var a = document.createElement('a');
          a.href = token.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = token.text;
          return a;
        }
        // 安全でないURLは、リンク化せずテキストとしてそのまま表示する
        return document.createTextNode(token.text);
      }
      return document.createTextNode(token.value);
    });
  }

  /**
   * Markdown文字列を安全なDocumentFragmentへ変換する（ブラウザ専用。documentを直接使う）。
   * 呼び出し側はこのFragmentをそのままappendChildすればよく、innerHTMLへの代入は不要。
   */
  function renderMarkdownToFragment(markdown) {
    var fragment = document.createDocumentFragment();
    var blocks = parseBlocks(markdown);

    blocks.forEach(function (block) {
      if (block.type === 'heading') {
        var level = Math.min(Math.max(block.level, 1), 6);
        var heading = document.createElement('h' + level);
        inlineTokensToNodes(parseInline(block.text)).forEach(function (node) {
          heading.appendChild(node);
        });
        fragment.appendChild(heading);
        return;
      }

      if (block.type === 'list') {
        var ul = document.createElement('ul');
        block.items.forEach(function (item) {
          var li = document.createElement('li');
          inlineTokensToNodes(parseInline(item)).forEach(function (node) {
            li.appendChild(node);
          });
          ul.appendChild(li);
        });
        fragment.appendChild(ul);
        return;
      }

      if (block.type === 'paragraph') {
        var p = document.createElement('p');
        block.lines.forEach(function (line, index) {
          if (index > 0) p.appendChild(document.createElement('br'));
          inlineTokensToNodes(parseInline(line)).forEach(function (node) {
            p.appendChild(node);
          });
        });
        fragment.appendChild(p);
      }
    });

    return fragment;
  }

  return {
    isSafeHttpUrl: isSafeHttpUrl,
    parseInline: parseInline,
    parseBlocks: parseBlocks,
    renderMarkdownToFragment: renderMarkdownToFragment,
  };
});
