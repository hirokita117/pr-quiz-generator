# ステップ4: Workflowの構築

このステップでは、定義した `Tool` を組み合わせて、クイズ生成の一連の処理フローを `Workflow` として定義します。Workflowにより、処理の順序、データの受け渡し、エラーハンドリングが堅牢になります。

## タスクリスト

- [ ] `createStep` を用いて各処理ステップを定義する
- [ ] `createWorkflow` を用いてステップを連結し、全体のワークフローを構築する

## 詳細

### 1. Workflowの定義

`src/mastra/workflows/quiz-generation.ts` ファイルを作成し、以下の内容を記述します。

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
// 前のステップで作成したツールをインポート
import { getPullRequestDetails } from '../tools/github-pr-fetcher';
import { generateQuizFromPR } from '../tools/quiz-generator';

// ステップ1: PR情報を取得する
const fetchPRStep = createStep({
  id: 'fetch-pr-details',
  inputSchema: z.object({ prUrl: z.string().url() }),
  outputSchema: z.object({ prData: z.any() }), // getPullRequestDetailsのoutputSchemaと合わせる
  execute: async ({ inputData, tools }) => {
    const prData = await tools.getPullRequestDetails.execute({
      prUrl: inputData.prUrl,
    });
    return { prData };
  },
});

// ステップ2: クイズを生成する
const generateQuizStep = createStep({
  id: 'generate-quiz-from-data',
  inputSchema: z.object({
    prData: z.any(),
    options: z.object({
      questionCount: z.number().default(5),
      language: z.enum(['ja', 'en']).default('ja'),
    }),
  }),
  outputSchema: z.object({ quiz: z.any() }), // generateQuizFromPRのoutputSchemaと合わせる
  execute: async ({ inputData, tools }) => {
    const quiz = await tools.generateQuizFromPR.execute({
      prData: inputData.prData,
      questionCount: inputData.options.questionCount,
      language: inputData.options.language,
    });
    return { quiz };
  },
});

// ワークフロー全体の定義
export const quizGenerationWorkflow = createWorkflow({
  id: 'quiz-generation-workflow',
  name: 'Quiz Generation Workflow',
  description: 'Generate an educational quiz from a GitHub PR URL.',
  inputSchema: z.object({
    prUrl: z.string().url(),
    options: z.object({
      questionCount: z.number().default(5),
      language: z.enum(['ja', 'en']).default('ja'),
    }).optional(),
  }),
  outputSchema: z.object({
    quiz: z.any(),
  }),
  // 処理の実行順序を定義
  steps: [fetchPRStep, generateQuizStep],
})
  .then(fetchPRStep, ({ input }) => ({
    prUrl: input.prUrl,
  }))
  .then(generateQuizStep, ({ prev, input }) => ({
    prData: prev.output.prData,
    options: input.options || {},
  }))
  .commit();
```

### ワークフローのポイント

- **ステップ (Step)**: `createStep` で、ワークフロー内の個々の処理単位を定義します。各ステップはインプットとアウトプットのスキーマを持ち、`execute` 関数でロジックを実行します。
- **データフロー**: `.then()` を使ってステップを連結します。2つ目以降の `then` では、前のステップ（`prev`）の出力やワークフロー全体の入力（`input`）にアクセスでき、次のステップへの入力を組み立てます。
- **堅牢性**: Mastraのワークフローは耐久性があり、各ステップの実行状態が記録されます。これにより、途中で失敗した場合のリトライやデバッグが容易になります。
- **ツールの利用**: `execute` 関数のコンテキストから `tools` オブジェクトにアクセスし、定義済みのツールを呼び出すことができます。
