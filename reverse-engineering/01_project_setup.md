## Phase 1: 環境構築とプロジェクトセットアップ

### 3.1 プロジェクト初期化

```bash
# プロジェクト作成
npm create mastra@latest github-pr-quiz \
  --components agents,tools,workflows \
  --llm google \
  --example

cd github-pr-quiz

# 追加パッケージのインストール
npm install @octokit/rest @ai-sdk/google zod parse-diff
npm install -D @types/parse-diff @vitejs/plugin-react tailwindcss
```

### 3.2 環境変数設定 (.env)

```env
# Google Gemini API設定
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# GitHub API設定（オプション：レート制限緩和用）
GITHUB_TOKEN=your_github_token_here

# アプリケーション設定
MASTRA_SERVER_PORT=4111
QUIZ_CACHE_ENABLED=true
QUIZ_CACHE_TTL=3600000
```

### 3.3 TypeScript設定 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```
