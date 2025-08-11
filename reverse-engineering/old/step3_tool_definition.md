# ステップ3: Toolの定義

このステップでは、アプリケーションのコアロジックを再利用可能な `Tool` として定義します。`Tool` は、特定の責務を持つ独立した関数であり、AgentやWorkflowから呼び出すことができます。

## タスクリスト

- [ ] `getPullRequestDetails` ツールを作成する
- [ ] `generateQuizFromPR` ツールを作成する
- [ ] （オプション）`sanitizePatchText` ツールを作成する

## 詳細

### 1. `getPullRequestDetails` ツールの実装

このツールは、PRのURLをインプットとして受け取り、`GitHub Integration` を利用してPRの詳細情報を取得し、整形して返します。

**ファイル:** `src/mastra/tools/github-pr-fetcher.ts`

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

// PR情報の出力スキーマを定義
const PROutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  files: z.array(z.object({
    filename: z.string(),
    status: z.string(),
    patch: z.string().optional(),
    additions: z.number(),
    deletions: z.number(),
  })),
  // 他に必要な情報（コミット、レビューなど）も追加
});

export const getPullRequestDetails = createTool({
  id: 'get-pull-request-details',
  name: 'Get Pull Request Details',
  description: 'Fetch comprehensive PR data from GitHub using a URL.',
  inputSchema: z.object({
    prUrl: z.string().url(),
  }),
  outputSchema: PROutputSchema,
  execute: async ({ inputData, integrations }) => {
    const { prUrl } = inputData;
    const github = integrations.github; // Mastraが提供するGitHub Integrationクライアント

    // URLからowner, repo, pull_numberを抽出
    const urlParts = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!urlParts) throw new Error('Invalid PR URL');
    const [, owner, repo, pullNumber] = urlParts;

    // GitHub APIを呼び出し
    const prResponse = await github.pulls.get({ owner, repo, pull_number: Number(pullNumber) });
    const filesResponse = await github.pulls.listFiles({ owner, repo, pull_number: Number(pullNumber) });
    
    // 必要な情報を整形して返す
    return {
      title: prResponse.data.title,
      description: prResponse.data.body || '',
      files: filesResponse.data.map(f => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch,
        additions: f.additions,
        deletions: f.deletions,
      })),
    };
  },
});
```

### 2. `generateQuizFromPR` ツールの実装

このツールは、`getPullRequestDetails` で取得したPRデータをインプットとし、LLM（Language Model）を利用してクイズを生成します。

**ファイル:** `src/mastra/tools/quiz-generator.ts`

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

// クイズの出力スキーマを定義
const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.number(),
    explanation: z.string(),
  })),
});

export const generateQuizFromPR = createTool({
  id: 'generate-quiz-from-pr',
  name: 'Generate Quiz from PR',
  description: 'Generate educational quiz questions from PR data using an LLM.',
  inputSchema: z.object({
    prData: z.any(), // 本来はPROutputSchemaを使うべき
    questionCount: z.number().default(5),
    language: z.enum(['ja', 'en']).default('ja'),
  }),
  outputSchema: QuizSchema,
  execute: async ({ inputData, model }) => {
    const { prData, questionCount, language } = inputData;
    
    // プロンプトを構築
    const systemPrompt = "あなたはプログラミング教育の専門家です。...";
    const userPrompt = `以下のPR情報に基づいて、${questionCount}個のクイズを${language}で生成してください。PR Title: ${prData.title}...`;

    // MastraのLLM抽象化レイヤーを通じてクイズを生成
    const response = await model.generateObject({
      model: model, // Agentから渡されるモデルを利用
      system: systemPrompt,
      prompt: userPrompt,
      schema: QuizSchema,
    });
    
    return response.object;
  },
});
```

`zod` を使用してインプットとアウトプットのスキーマを定義することで、データの整合性と型安全性を確保します。
`execute` 関数内では、`integrations` や `model` といったコンテキストオブジェクトにアクセスでき、他のMastraコンポーネントと連携します。
