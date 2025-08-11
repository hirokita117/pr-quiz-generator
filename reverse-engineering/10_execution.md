## 12. 実行手順

### 12.1 開発環境での実行

```bash
# 1. 環境変数の設定
cp .env.example .env
# .envファイルを編集してGoogle Gemini APIキーを設定

# 2. 依存関係のインストール
npm install

# 3. 開発サーバーの起動
npm run dev

# 4. ブラウザでアクセス
# - Mastra Playground: http://localhost:4111
# - アプリケーションUI: http://localhost:3000
```

### 12.2 プロダクションビルド

```bash
# ビルド
npm run build

# プロダクション実行
npm start
```
