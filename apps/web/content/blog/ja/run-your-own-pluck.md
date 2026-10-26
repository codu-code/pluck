---
title: Pluckを自分で動かす。
description: docker composeひとつ、メモリ1GBで、同じアプリが自分のサーバーで動きます。面倒なところも含めて、全部書きました。
keywords: あとで読む セルフホスト, Pocket 代わり セルフホスト, あとで読む Docker, ブックマーク管理 セルフホスト, オープンソース あとで読む サーバー
---

getpluck.ioのPluckは無料です。同じコードが自分のサーバーでも動き、起動はコマンドひとつです。

面倒なところも含めて、全部ここに書きます。

![ターミナルでPluckを起動し、同じインボックスが自宅サーバーのアドレスで動いている。](/blog/run-your-own-pluck/hero.png)

## 必要なもの

Dockerと、1vCPU・メモリ1GBのマシン。小さなVPSでも、古いノートパソコンでも、テレビの下に置いてある箱でも動きます。

## 起動する

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

http://localhost:3000 を開きます。Pluckはメールで届くリンクでサインインします。インストールしたばかりの状態では、そのメールは内蔵のメールキャッチャー http://localhost:8025 に届きます。試すだけなら、メールサーバーは要りません。

## 動いているもの

Dockerイメージはひとつで、それを2回起動します。ひとつはアプリを配信します。もうひとつはワーカーで、ページを読み込み、手つかずのアイテムを夜のうちにアーカイブへ移し、月曜のメールを送り、ゴミ箱を空にします。

その横で動くのは、ライブラリ用のMongoDB、残したページとファイル用のMinIO、そしてメールを受け止めるMailpitです。

## 本番のアドレスに置く

HTTPS対応のリバースプロキシを前に置き、composeファイルの隣の `.env` ファイルに次を設定します：

- `PLUCK_URL`：使うアドレス。
- `SMTP_URL` と `EMAIL_FROM`：サインインのメールが実際の受信箱に届くように。
- `S3_ACCESS_KEY` と `S3_SECRET_KEY`：デフォルト値の代わりに。

公開アドレスでは、ストレージのパスワードがデフォルトのままだと、Pluckは起動しません。わざとです。すべての設定は[セルフホストのガイド](https://github.com/codu-code/pluck/blob/main/docs/self-host.md)にあります。

## アプリをつなぐ

- **iPhone**：iPhoneで `pluck://signin?server=https://your.address` を開きます。アプリは代わりに、自分のサーバーにサインインします。
- **Chrome**：ストア版の拡張機能は、getpluck.ioとしか通信しません。`PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` で自分用をビルドし、パッケージ化されていない拡張機能として読み込みます。
- **お使いのAI**：`https://your.address/mcp` に接続します。サーバーに公開アドレスがなければ、設定でAPIキーを作り、`npx @pluck/mcp --server https://your.address --key pk_live_…` を使います。

## 面倒なところ

メールでPluckを使うには、自分のドメイン宛てのメールを受け取って、ストレージに置くサービスが必要です。composeファイルには入っていないので、何を用意すればいいかはガイドで説明しています。

バックアップは自分で取ります。`mongo` と `minio` のボリュームをバックアップしてください。それがライブラリのすべてです。

## アップグレード

```
git pull && docker compose up -d --build
```

サーバーはAGPL-3.0、アプリはMITです。

もし私たちがやめても、あなたのPluckは止まりません。
