# ゆめみらい業務評価アプリ

Next.js + TypeScript + Tailwind CSS で作成した、業務評価シート記入・360°評価・集計分析アプリです。

## 主な機能

- ログインと権限管理（院長 / スタッフ）
- スタッフ管理
- 評価項目管理
- 360°評価入力
- 院長評価入力
- スタッフ向け成長サマリー
- 院長向け集計分析
- 評価結果一覧と削除
- PDF出力
- JSONファイル保存

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## ログイン初期値

- 院長: ID `director` / パスワード `0000`
- スタッフ: ID `staff-1`, `staff-2` ... / 初期パスワード `1111`

パスワードは `data/yumemirai.json` にハッシュ化して保存されます。院長画面からスタッフのパスワード初期化ができます。

## ビルド確認

```bash
npm run build
npm run start
```

`npm run build` が成功すれば、Vercelでも標準の Next.js プロジェクトとしてビルドできます。

## Vercel公開手順

1. GitHubにこのプロジェクトをアップロードします。
2. Vercelで「Add New Project」を選び、GitHubリポジトリを選択します。
3. Framework Preset は `Next.js` を選択します。
4. Build Command は `npm run build` のままで問題ありません。
5. Install Command は `npm install` のままで問題ありません。
6. Output Directory は未設定のままで問題ありません。
7. Deploy を実行します。

## 環境変数

現時点では必須の環境変数はありません。

任意で以下を使えます。

- `DATA_FILE_PATH`: JSON保存ファイルのパスを変更したい場合に指定します。

例:

```bash
DATA_FILE_PATH=/tmp/yumemirai.json
```

## VercelでJSON保存のまま公開する場合の注意点

このアプリは現在、`data/yumemirai.json` にデータを保存します。

Vercelの本番環境はサーバーレス実行のため、アプリ内のJSONファイルへの書き込みは永続保存には向きません。デプロイ直後の初期データ表示やデモ用途には使えますが、以下の制限があります。

- デプロイ後に変更したデータは永続化されない、または実行環境の再作成で失われる可能性があります。
- 複数ユーザーが同時に編集すると、JSONファイル保存では競合が起きる可能性があります。
- 本番運用では Supabase、Firebase、PostgreSQL、Vercel Postgres などの外部データベースへの移行を推奨します。

院内で継続利用する場合は、Vercel公開版をデモ・確認用、本番運用は外部DB接続版にするのが安全です。

## GitHubにアップロードする前の確認

`.gitignore` で以下を除外しています。

- `node_modules/`
- `.next/`
- `.vercel/`
- `.env` 系ファイル
- `work/`, `outputs/`
- ログ・一時ファイル

`package-lock.json` は再現性のためコミット対象です。

## データファイルについて

`data/yumemirai.json` は初期マスターデータとして利用します。GitHubにアップロードすると、このJSONに含まれる初期スタッフ、評価項目、ハッシュ化済みユーザー情報も含まれます。

公開リポジトリにする場合は、実在スタッフ名や評価データを含めないサンプルデータへ差し替えてからアップロードしてください。


## Supabase データ保存

このアプリは、認証は従来のログイン方式のまま、データ保存先だけを Supabase に切り替えられます。

### 1. Supabase テーブル作成

Supabase の SQL Editor で以下を実行してください。

- `supabase/schema.sql`

作成されるテーブルは `yumemirai_app_data` です。以下のデータをカテゴリ別 JSONB として保存します。

- staff
- jobRoles
- evaluationItems
- ratingCriteria
- evaluations
- evaluationScores
- evaluationCycles
- users / passwords
- comments

### 2. 環境変数

`.env.local.example` を参考に、`.env.local` または Vercel の Environment Variables に設定してください。

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_APP_DATA_TABLE=yumemirai_app_data
SUPABASE_APP_DATA_ID=default
```

`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されている場合は Supabase を使用します。未設定の場合は従来どおりローカル JSON 保存を使用します。

### 3. 初回同期

Supabase が空の場合、既存の `data/yumemirai.json` を読み込み、初回起動時に Supabase へ保存します。以後の保存は Supabase 側に反映されます。

### 4. Vercel 公開時の注意

Vercel 本番環境ではローカル JSON ファイルへの保存は永続化されません。本番運用では必ず Supabase の環境変数を設定してください。

Supabase Auth はまだ使用していません。ログインID・パスワードは従来どおりアプリ内の users データにハッシュ化して保存されます。
