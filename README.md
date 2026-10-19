# SakuzuMaster

コンパスと定規の作図問題を、ブラウザ上で実際に作図しながら解けるサイトです（静的サイト / GitHub Pages）。
公開先：https://sakuzu.kdking-tools.com/

- `engine.js`：幾何計算と作図ボード（コンパス・定規・点・長さを写す、お手本の再生、完成判定）、コメント欄（giscus）の読み込み
- `problems.js`：問題データ。はじめの図形・お手本の手順・完成条件・解説文
- `tools/build.js`：`problems.js` から `index.html`・`problems/*.html`・読み物・`sitemap.xml` を生成します
- `tools/test.js`：全問題について、お手本どおりに作図すると完成判定になるかを確かめます

問題を追加・修正したら：

```
node tools/test.js
node tools/build.js
```

コメント欄は giscus を使います。リポジトリの Discussions を有効にして giscus アプリを入れたあと、`engine.js` の `GISCUS.repoId` と `GISCUS.categoryId` を設定すると表示されます。
