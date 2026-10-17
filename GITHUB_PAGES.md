# GitHub Pagesでスマートフォンから使う

GitHub Pagesにアプリの画面ファイルを置くと、パソコンを停止していてもスマートフォンから開けます。初回と更新時は通信が必要です。一度開いてオフライン準備が完了すると、保存済みアプリを通信なしでも使えます。

薬の記録は今までどおりスマートフォンのlocalStorageに保存し、GitHubへ送信しません。父母の端末間の共有はありません。デザインとチェック機能は維持しています。

## 今回の修正

- Viteの`base`を公開URLに合わせる設定へ変更。
- Manifest・アイコン・Service Workerの登録先・キャッシュ・オフライン復元先を、`/リポジトリ名/`配下へ統一。
- PWAの開始URLとscopeも同じパスに設定。
- 同じ`github.io`の別リポジトリのキャッシュを削除しない構造に変更。
- GitHub公式のPages用Actionsを追加。テストとビルド確認後、`dist`だけを配信。

以下はリポジトリ名を`okusuri-check`にする例です。別の名前でも、Actionsが実際の公開先を取得するためコード変更は不要です。

## 無料で使う条件

**GitHub FreeのPublic（公開）リポジトリ**と、用意したワークフローの標準Ubuntuランナーを使います。独自ドメイン・有料プラン・外部データベース・通知サービスは不要です。GitHub PagesとActionsには利用上限があります。

公式資料：[GitHub Pagesの提供条件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Actionsの無料利用](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。

Publicではソースも公開されます。本名・生年月日・投薬の実記録・バックアップ・秘密鍵はアップロードしないでください。公開用ソースZIPには端末内の記録を含めていません。

## 1. GitHubアカウントを用意する

1. パソコンで [github.com](https://github.com/) を開きます。
2. 「Sign up」でアカウントを作成します。作成済みならログインします。
3. メール確認が求められたら完了します。有料プランを選ぶ必要はありません。

## 2. リポジトリを作る

1. 右上「＋」→「New repository」を選びます。
2. Repository nameに `okusuri-check` を入力します。
3. **Public**を選びます。
4. 最初のブランチを用意するため「Add a README file」を有効にします。
5. 「Create repository」を押します。通常の初期ブランチ`main`を使います。

## 3. Pagesを有効にする

1. リポジトリの「Settings」を開きます。
2. 左側の「Pages」を選びます。
3. 「Build and deployment」の「Source」を **GitHub Actions** にします。
4. 別のサンプルワークフローは作りません。このアプリに設定を用意しています。

Pagesが表示されないときは、Publicリポジトリか、自分が所有者としてログインしているか確認します。

## 4. アプリのソースを入れる

配布した `okusuri-check-github-source.zip` をダウンロードし、パソコン上で**展開**します。ZIPをそのままGitHubへ置いてもアプリは公開されません。

1. 展開先で、`package.json`、`pnpm-lock.yaml`、`src`、`public`、`.github`が並ぶ階層を開きます。
2. GitHubの「Code」→「Add file」→「Upload files」を選びます。
3. その階層にあるファイルとフォルダーを、まとめて画面へドラッグします。外側の「okusuri-check-github-source」フォルダーごとではなく、**中身**を入れます。
4. **`.github/workflows/pages.yml`が含まれていることを確認**します。dotで始まるフォルダーも省略しません。
5. `node_modules`、`dist`、`.tools`、旧開発用フォルダー、バックアップJSONは入れません。配布ZIPはこれらを除外済みです。
6. 「Commit changes」で`main`へ保存します。初めに作ったREADMEはアプリのREADMEで置き換わります。

リポジトリ直下に`package.json`と`pnpm-lock.yaml`があることが大切です。この操作でビルドと公開が始まります。

## 5. 公開URLを確認する

1. リポジトリの「Actions」を開きます。
2. 「Publish to GitHub Pages」を選び、緑のチェックになるまで待ちます。初回は数分かかることがあります。
3. 「Settings」→「Pages」→「Visit site」に表示されたURLを確認します。

通常は次の形式になります。

```text
https://あなたのGitHubユーザー名.github.io/okusuri-check/
```

これは例なので、**GitHubに表示された実際の「Visit site」のURL**を使ってください。`github.com/...`のリポジトリ画面や、以前の`192.168...`・`127.0.0.1`とは別です。

設定欄がある場合は「Enforce HTTPS」を有効にします。独自ドメインの設定は不要です。

## 6. スマートフォンへ追加する

1. 公開されたHTTPS URLをスマートフォンの**Chrome**で開きます。
2. お薬一覧と「この端末・このブラウザだけに保存」の説明を確認します。
3. 「オフライン利用の準備ができています」と表示されるまで通信を維持します。
4. Chromeメニュー →「ホーム画面に追加」または「アプリをインストール」を選びます。
5. ホーム画面のアイコンから開きます。
6. パソコンを停止し、モバイル通信でも開けることを確認します。
7. 初回準備後に機内モードでも開き、保存・履歴の再表示を確認します。試験用チェックを実際の投薬記録と混同しないでください。

父母それぞれで同じURLを使えますが、記録は共有されません。メッセージアプリ内ブラウザは保存領域が違う場合があるため、普段使うChromeに統一してください。

## 今までの記録を移す

公開先は以前のパソコン内・自宅Wi-FiのURLとは保存領域が異なり、自動では引き継がれません。

1. 以前使っていた**スマートフォン・ブラウザ**で旧URLを開きます。パソコンから配信していた場合、この移行時だけパソコンの起動が必要です。
2. アプリの「設定」→「バックアップを保存」でJSONを保存します。
3. 新しいGitHub PagesのHTTPS URLを開きます。
4. 「設定」→「バックアップを読み込む」でJSONを選び、確認して復元します。

新URLですでに記録している場合は、その記録も先にバックアップしてください。以後は同じHTTPS URLを使い続け、時々バックアップを保存します。

## 困ったとき

| 状態                                       | 確認すること                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Actionsが動かない                          | `.github/workflows/pages.yml`があるか、`main`に保存したか、Actionsが有効か           |
| package.jsonやロックファイルが見つからない | 展開したZIPの中身をリポジトリ直下へ入れたか                                          |
| Configure Pagesで失敗                      | Settings → Pages → SourceをGitHub Actionsへ変更後、失敗した実行の「Re-run all jobs」 |
| 権限エラー                                 | 自分のリポジトリか、組織のポリシーがPages・Actionsを禁止していないか                 |
| 404                                        | Actionsが緑か、Visit siteのURLか、末尾に`/`があるか。初回公開直後は少し待つ          |
| 白い画面・アイコンが出ない                 | 最新ソースか。baseを古いリポジトリ名に固定していないか                               |
| オフライン準備が終わらない                 | HTTPSか、通信可能な状態で一度再読み込みしたか                                        |
| 前の記録がない                             | 端末・ブラウザ・URLが変わっていないか。旧URLからバックアップで移行                   |

手動実行は「Actions」→「Publish to GitHub Pages」→「Run workflow」です。

## 更新方法

同じリポジトリの`main`へ更新したソースを保存すると再公開されます。同じHTTPS URLなら保存領域は変わりません。アップデートはlocalStorageを削除しません。更新前にバックアップし、更新後はアプリを閉じて開き直します。

## 開発者向け：サブパスのローカル確認

通常の`pnpm build`はドメイン直下用です。PowerShellでプロジェクトURL相当を確認する場合：

```powershell
$env:VITE_BASE_PATH = '/okusuri-check/'
pnpm build
pnpm check:build
pnpm preview
```

プレビューは `http://127.0.0.1:4173/okusuri-check/` です。同じ環境変数で`pnpm test:e2e`も実行できます。通常の配信へ戻す場合：

```powershell
Remove-Item Env:VITE_BASE_PATH
pnpm build
```

GitHub上ではワークフローが実際の公開先から`VITE_BASE_PATH`を設定します。ユーザーサイトや独自ドメインなどドメイン直下の公開先では`/`になります。

参考：[ViteのPages手順](https://vite.dev/guide/static-deploy.html#github-pages)、[Pagesワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。
