# NameCard — 名刺管理システム

AI搭載の社内名刺管理 Web アプリケーション。  
Google Drive に投入した名刺スキャンを **Gemini AI** で自動解析し、Cloudflare D1 に顧客データとして蓄積します。

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript |
| **Backend** | Cloudflare Pages Functions (Workers) |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 (名刺画像) |
| **AI** | Google Gemini 1.5 Flash (OCR + 構造化抽出) |
| **Drive** | Google Drive API v3 (サービスアカウント JWT 認証) |

## Architecture

```
src/
├── types/          # TypeScript型定義（Customer, API Response）
├── lib/            # APIクライアント（fetch統一層）
├── hooks/          # カスタムフック（useCustomers, useSync）
├── components/     # 再利用コンポーネント（CustomerTable, BulkEditModal, SyncPanel, Sidebar）
├── constants/      # 定数（AIプロンプト、テーブル列定義）
├── contexts/       # React Context（SyncContext — Drive同期ステートマシン）
├── pages/          # ページコンポーネント（Dashboard, CustomerDetail）
└── utils/          # ユーティリティ（exchanger-colors）

functions/api/
├── _shared/        # 共有ユーティリティ（Google Drive認証, 型定義）
├── customers/      # 顧客CRUD + 一括編集 + 重複統合
├── drive/          # Drive連携（list, download, move, claim, cleanup, fix, restore-skipped）
├── image/          # R2画像配信
├── parse.ts        # Gemini AI 解析エンドポイント
└── upload.ts       # R2アップロード
```

## Quick Start

```bash
# 依存のインストール
npm install

# 環境変数の設定
cp .dev.vars.example .dev.vars
# GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GEMINI_API_KEY を設定

# 開発サーバー起動
npm run dev

# ビルド + デプロイ
npm run deploy
```

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Vite 開発サーバー起動 |
| `npm run build` | TypeScript チェック + 本番ビルド |
| `npm run deploy` | ビルド + Cloudflare Pages デプロイ |
| `npm run lint` | ESLint 実行 |
| `npm run typecheck` | TypeScript 型チェックのみ |
| `npm run db:execute` | D1 に schema.sql を適用 |

## Environment Variables (`.dev.vars`)

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_EMAIL` | ✅ | Google サービスアカウントのメールアドレス |
| `GOOGLE_PRIVATE_KEY` | ✅ | Google サービスアカウントの秘密鍵 (PEM) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API キー |

## Database Schema

顧客データは `customers` テーブル（26+ フィールド）、スキャンデータは `scans` テーブルに格納。  
詳細は [`schema.sql`](./schema.sql) を参照。
