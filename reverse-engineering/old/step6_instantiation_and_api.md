# ステップ6: Mastraインスタンスの初期化とAPIエンドポイントの実装

このステップでは、これまでに定義したすべてのMastraコンポーネント（Integration, Tool, Workflow, Agent）を統合し、単一の `Mastra` インスタンスを生成します。さらに、このインスタンスを使用して、Next.jsアプリケーションのAPIエンドポイントを実装します。

## タスクリスト

- [ ] LLMプロバイダーの設定を定義する
- [ ] Mastraインスタンスを初期化する
- [ ] Next.js APIルートを作成し、ワークフローを呼び出すロジックを実装する

## 詳細

### 1. LLMモデルの設定

まず、使用するLLMプロバイダーを定義します。

**ファイル:** `src/mastra/models/index.ts`
```typescript
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

// 使用したいモデルをオブジェクトとしてエクスポート
export const models = {
  openai: {
    'gpt-4-turbo': openai('gpt-4-turbo'),
    'gpt-3.5-turbo': openai('gpt-3.5-turbo'),
  },
  google: {
    'gemini-1.5-pro': google('gemini-1.5-pro-latest'),
  },
  anthropic: {
    'claude-3-haiku': anthropic('claude-3-haiku-20240307'),
  },
};
```

### 2. Mastraインスタンスの初期化

次に、すべてのコンポーネントを統合します。

**ファイル:** `src/mastra/index.ts`
```typescript
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { githubIntegration } from './integrations/github';
import { quizGeneratorAgent } from './agents/quiz-generator';
import { quizGenerationWorkflow } from './workflows/quiz-generation';
import * as tools from './tools'; // tools/index.tsで集約している想定

export const mastra = new Mastra({
  agents: {
    quizGenerator: quizGeneratorAgent,
  },
  workflows: {
    quizGeneration: quizGenerationWorkflow,
  },
  tools: {
    ...tools,
  },
  integrations: {
    github: githubIntegration,
  },
  logger: new PinoLogger({ name: 'PR-Quiz-Generator' }),
  db: { // ワークフローの実行状態などを保存するデータベース
    type: 'sqlite',
    path: './data/mastra.db',
  },
});
```

### 3. APIエンドポイントの実装

最後に、Next.jsのAPIルートでMastraワークフローを呼び出します。

**ファイル:** `src/app/api/quiz/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { mastra } from '@/mastra'; // 初期化したMastraインスタンス
import { z } from 'zod';

// リクエストボディのスキーマ定義
const RequestSchema = z.object({
  prUrl: z.string().url(),
  options: z.object({ /* ... */ }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);

    // Mastraワークフローを実行
    const result = await mastra.workflows.quizGeneration.execute({
      input: {
        prUrl: validatedData.prUrl,
        options: validatedData.options || {},
      },
      // オプション: 実行IDを指定
      executionId: `quiz-gen-${Date.now()}`,
    });

    if (result.status === 'completed') {
      return NextResponse.json({ success: true, data: result.output.quiz });
    } else {
      // エラー処理
      return NextResponse.json({ success: false, error: result.error?.message }, { status: 500 });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid request data' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
  }
}
```

これで、フロントエンドから `/api/quiz` にリクエストを送ることで、Mastraで構築した一連のクイズ生成処理を安全かつ堅牢に実行できるようになります。
