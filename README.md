# Google 検索スクレイパー for Cloudflare Workers

無料で BOT 検知のない Google 検索の API サーバーが構築できます

## やること

-   `pnpm i`
-   `wrangler secret put SG_SS`と入力してエンターした後 stdin から SG_SS クッキーを入力して `SG_SS` を設定してください(解説あり)
-   `wrangler.json`の`route`を環境に合わせて設定する
-   `wrangler.json`の`d1_databases`の`database_name`と`database_id`を環境に合わせて設定する
-   `example.drizzle.config.ts`のファイル名を`drizzle.config.ts`に変更し、Cloudflare の`accountId`,`databaseId`,`token`を書き込む。

`databaseId`と`wrangler.json`の`database_id`は同じ。

`token`は[マイ プロフィール > API トークン](https://dash.cloudflare.com/profile/api-tokens)で`アカウント.D1 編集`の権限を付けた API トークンを作成する。

-   `pnpm run generate`
-   `pnpm run up`
-   `pnpm run deploy`

https://\<project>.\<account>.workers.dev を使いたい場合

-   `wrangler.json`の`workers_dev`を`true`にする
-   `wrangler.json`の`route`をキーごと消す

## 解説

### フローチャート？

1. **YOU** GET /search?q=
2. **CF Workers** クエリパラメータの存在確認や型確認
3. DB 接続 & DB から AEC,NID クッキー取得
4. 4-1：クッキーがあればそれを使う, 4-2：なければ SG_SS を使いクッキーを生成し、保存する
5. リクエストを投げる
6. 6-1：正常なレスポンスであればパースし、応答する, 6-2：ではないならセッション期限切れだと判断し、

SG_SS を使いクッキーを生成し直して保存する & リクエストを投げて５に戻る(再再試行はない)

### クッキー：SG_SS

SG_SS はブラウザのシークレットウィンドウなどでセッションがまだない状態で Google 検索を行い、

１回目の GET の HTML レスポンス内の JS により計算され、**２回目の GET のリクエストクッキーから取れます。**

SG_SS の値が**正しい**なら検索結果が帰ってきますが、**間違っている**ならば reCAPTCHA の画面が出ます。

有効期限：5 日 or 7 日 要検証

### なぜ D1 が使われている！？(& Drizzle)

CF D1 と Drizzle は生成した AEC,NID クッキーを保存するために使われています。

CF D1 を使った理由は CF KV と比べてリード回数上限が高いからです。

## クレジット & ありがとう

利用や改変は自由です。

これを利用して作られたものを公開か販売する際は僕と Paicha のクレジットを載せてください。

正常レスポンス時のパーサーは[Paicha 製](https://voids.top/)Python コードを移植しました。

(移植前のソースコードは非公開です)
