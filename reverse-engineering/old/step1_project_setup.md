# ステップ1: Mastraプロジェクトのセットアップ

このステップでは、Mastraを使用した新しいプロジェクトの基盤を構築します。

## タスクリスト

- [ ] Mastraプロジェクトの初期化
- [ ] 必要な依存関係の追加

## 詳細

### 1. Mastraプロジェクトの初期化

新しいディレクトリで以下のコマンドを実行し、Mastraプロジェクトを作成します。

```bash
npx create-mastra@latest pr-quiz-generator-mastra
```

**設定項目:**
- **テンプレート**: TypeScript
- **フレームワーク**: Next.js 14 (App Router)

これにより、基本的なプロジェクト構造と設定ファイルが生成されます。

### 2. 依存関係の追加

プロジェクトに必要な追加のライブラリをインストールします。`pr-quiz-generator-mastra` ディレクトリに移動してから実行してください。

```bash
npm install @mastra/core @mastra/loggers @ai-sdk/openai @ai-sdk/google @ai-sdk/anthropic zod @octokit/rest
```

これにより、Mastraのコア機能、ロガー、各種LLMプロバイダー、データ検証ライブラリ（zod）、GitHubクライアント（@octokit/rest）が利用可能になります。
