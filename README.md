# ai-work

Claude Codeを使った学習・開発用の作業リポジトリです。

## 記事ページ（line-life-log連携）

`articles.html` で、個人ログ管理アプリ「line-life-log」から公開（PUBLISHED）された記事の
一覧・詳細を表示します（`articles.html?slug=...`が詳細ページ）。

- 通常時（GitHub Pages本番運用）: 同梱の `data/articles.json`（静的JSON）を読み込みます。
  line-life-log側のdevサーバーやngrokが停止していても表示できます。詳細は
  [`data/README.md`](data/README.md) を参照してください。
- ローカル確認時のみ: URLに `?api=http://localhost:3000` のようにクエリパラメータを付けると、
  line-life-log側の `GET /api/public/articles` から直接取得します（一覧・詳細・「記事一覧へ戻る」
  導線のいずれでもこの指定は維持されます）。この上書きはURLのみで完結し、コミット対象の
  ファイルには一切残りません。

### 公開手順（記事を追加・更新する場合）

1. line-life-log側の管理画面で記事を公開（PUBLISHED）にする
2. line-life-log側で `npm run export:public` を実行する
3. 生成された `storage/public-export/articles.json` の内容を確認する
4. 問題がなければ、このファイルをこのリポジトリの `data/articles.json` へ上書きコピーする
5. `git diff` で差分を確認し、問題がなければ `git commit` する
6. 公開してよいと判断したら `git push` する（push した時点でGitHub Pagesへ反映されます）

この一連の操作はすべて人間が明示的に行うものであり、自動化・自動pushは行われません。

### 取消・緊急非公開手順

特定の記事を非公開に戻したい場合は、line-life-log側でその記事を「公開停止」にしてから
上記の手順をやり直してください（次回のエクスポートで自動的に除外されます）。

すべての記事を即座に非公開へ戻したい場合は、`data/articles.json` の内容を
`{"articles": []}` に置き換えて `git commit` ・ `git push` するだけで反映されます
（コードの変更は不要です）。
