# ステップ2: GitHub Integrationの作成

このステップでは、Mastraの `Integration` 機能を利用して、GitHub APIとの連携をカプセル化します。これにより、認証管理が簡素化され、型安全なクライアントをツールから利用できるようになります。

## タスクリスト

- [ ] GitHub Integration用のファイルを作成する
- [ ] `createIntegration` を使用してGitHub連携を定義する
- [ ] Octokitクライアントを初期化するロジックを実装する

## 詳細

### 1. `createIntegration` を使用した定義

`src/mastra/integrations/github/index.ts` というファイルを作成し、以下の内容を記述します。

```typescript
// src/mastra/integrations/github/index.ts
import { createIntegration } from '@mastra/core';
import { Octokit } from '@octokit/rest';

export const githubIntegration = createIntegration({
  name: 'github',
  auth: {
    type: 'oauth2', // もしくは 'pat' (Personal Access Token) などユースケースに応じて
    config: {
      // OAuth2の場合
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'read:user'],
      
      // PATの場合
      // token: process.env.GITHUB_TOKEN!
    },
  },
  client: ({ auth }) => {
    // auth.accessToken はMastraが自動的に管理するトークンを指します
    return new Octokit({
      auth: auth.accessToken,
    });
  },
});
```

### 考慮事項

- **認証方法**:
  - ここでは `oauth2` を例としていますが、サーバーサイドで完結するアプリケーションの場合は、Personal Access Token (PAT) を使用する `'pat'` の方がシンプルかもしれません。その場合、`config` には `token` を設定します。
- **環境変数**:
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN` などの認証情報は、`.env.local` ファイルに設定し、`process.env` を介して安全に読み込みます。
- **クライアント**:
  - `client` ファクトリ関数内で、Mastraが管理する認証情報（`auth` オブジェクト）を使って `Octokit` インスタンスを生成します。これにより、このIntegrationを利用するツールは、認証を意識することなくAPIを呼び出せます。
