# data/articles.json について

このファイルは、line-life-log（個人ログ管理アプリ）側で `npm run export:public` を実行して
生成された `articles.json` を、人間が手動でコピーしたものです。

## 運用ルール

- 通常はこのファイルを直接手編集しないでください。line-life-log側の管理画面で記事を
  公開（PUBLISHED）にしたうえで `npm run export:public` を実行し、生成された
  `storage/public-export/articles.json` をこのファイルへ上書きコピーしてください。
- コピー後は必ず `git diff` で差分を確認してください（意図しない記事の追加・削除・
  内容変更がないか、公開してよい内容かを人間の目で確認するためのものです）。
- 確認後、`git commit` と `git push` は人間が明示的に実行してください（自動化されていません）。
  `git push` した時点でGitHub Pagesへ反映されます。

## 緊急時に全記事を非公開に戻す場合

このファイルの内容を以下に置き換えてから `git commit` ・ `git push` してください。

```json
{
  "articles": []
}
```

## このファイルに含めてはいけないもの

- line-life-logの元ログ本文・元ログID
- 管理用の内部情報（ステータス、AI解析結果、revision履歴など）
- 認証情報・APIキーなどの秘密情報

これらは line-life-log 側の `listPublicArticles()` が元々出力しない設計になっているため、
正しい手順でコピーする限り混入することはありません。
