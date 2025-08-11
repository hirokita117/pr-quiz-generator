# PR Quiz GeneratorのMastra実装タスクドキュメント

## 概要
本ドキュメントは、現在のPR Quiz GeneratorアプリケーションをMastraフレームワークを使用して再実装するための詳細な実装タスクを定義します。

## 1. プロジェクト構造

### 現在の構造からMastraベースの構造への移行

```
pr-quiz-generator-mastra/
├── src/
│   ├── mastra/
│   │   ├── index.ts                 # Mastraインスタンスの初期化
│   │   ├── agents/
│   │   │   └── quiz-generator.ts    # クイズ生成エージェント
│   │   ├── tools/
│   │   │   ├── github-pr-fetcher.ts # GitHub PR取得ツール
│   │   │   ├── quiz-generator.ts    # クイズ生成ツール
│   │   │   └── sanitizer.ts         # データサニタイズツール
│   │   ├── workflows/
│   │   │   └── quiz-generation.ts   # クイズ生成ワークフロー
│   │   └── integrations/
│   │       └── github/              # GitHub統合設定
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   └── quiz/
│   │   │       └── route.ts        # APIエンドポイント
│   │   └── page.tsx                # メインUI
│   └── components/                  # UIコンポーネント
├── .env.local                       # 環境変数
└── mastra.config.ts                # Mastra設定ファイル
```

## 2. 実装タスク

### フェーズ1: プロジェクトセットアップ（優先度: 高）

#### タスク1.1: Mastraプロジェクトの初期化
```bash
npx create-mastra@latest pr-quiz-generator-mastra
```
- **必要な作業**:
  - TypeScriptテンプレートを選択
  - Next.js 14 (App Router)を選択
  - 必要なパッケージのインストール

#### タスク1.2: 依存関係の追加
```json
{
  "dependencies": {
    "@mastra/core": "latest",
    "@mastra/loggers": "latest",
    "@ai-sdk/openai": "latest",
    "@ai-sdk/google": "latest",
    "@ai-sdk/anthropic": "latest",
    "zod": "^3.22.4",
    "@octokit/rest": "latest"
  }
}
```

### フェーズ2: GitHub Integration（優先度: 高）

#### タスク2.1: GitHub Integrationの作成
```typescript
// src/mastra/integrations/github/index.ts
import { createIntegration } from '@mastra/core';
import { Octokit } from '@octokit/rest';

export const githubIntegration = createIntegration({
  name: 'github',
  auth: {
    type: 'oauth2',
    config: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'read:user'],
    },
  },
  client: ({ auth }) => {
    return new Octokit({
      auth: auth.accessToken,
    });
  },
});
```

#### タスク2.2: GitHub PR取得ツールの実装
```typescript
// src/mastra/tools/github-pr-fetcher.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const getPullRequestDetails = createTool({
  id: 'get-pull-request-details',
  name: 'Get Pull Request Details',
  description: 'Fetch comprehensive PR data from GitHub',
  inputSchema: z.object({
    prUrl: z.string().url(),
  }),
  outputSchema: z.object({
    title: z.string(),
    description: z.string(),
    files: z.array(z.object({
      filename: z.string(),
      status: z.string(),
      patch: z.string().optional(),
      additions: z.number(),
      deletions: z.number(),
    })),
    commits: z.array(z.object({
      sha: z.string(),
      message: z.string(),
      author: z.string(),
    })),
    reviews: z.array(z.object({
      user: z.string(),
      state: z.string(),
      body: z.string().optional(),
    })),
  }),
  execute: async ({ inputData, integrations }) => {
    const { prUrl } = inputData;
    const github = integrations.github;
    
    // URLパース
    const urlParts = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!urlParts) throw new Error('Invalid PR URL');
    
    const [, owner, repo, pullNumber] = urlParts;
    
    // PR情報の取得
    const [pr, files, commits, reviews] = await Promise.all([
      github.pulls.get({ owner, repo, pull_number: Number(pullNumber) }),
      github.pulls.listFiles({ owner, repo, pull_number: Number(pullNumber) }),
      github.pulls.listCommits({ owner, repo, pull_number: Number(pullNumber) }),
      github.pulls.listReviews({ owner, repo, pull_number: Number(pullNumber) }),
    ]);
    
    return {
      title: pr.data.title,
      description: pr.data.body || '',
      files: files.data.map(f => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch,
        additions: f.additions,
        deletions: f.deletions,
      })),
      commits: commits.data.map(c => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name || 'Unknown',
      })),
      reviews: reviews.data.map(r => ({
        user: r.user?.login || 'Unknown',
        state: r.state,
        body: r.body,
      })),
    };
  },
});
```

### フェーズ3: LLMモデル設定とツール実装（優先度: 高）

#### タスク3.1: LLMプロバイダー設定
```typescript
// src/mastra/models/index.ts
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

export const models = {
  openai: {
    'gpt-4': openai('gpt-4'),
    'gpt-4-turbo': openai('gpt-4-turbo'),
    'gpt-3.5-turbo': openai('gpt-3.5-turbo'),
  },
  google: {
    'gemini-2.0-flash': google('gemini-2.0-flash'),
    'gemini-2.5-flash': google('gemini-2.5-flash'),
    'gemini-2.5-pro': google('gemini-2.5-pro'),
  },
  anthropic: {
    'claude-3-opus': anthropic('claude-3-opus-20240229'),
    'claude-3-sonnet': anthropic('claude-3-sonnet-20240229'),
    'claude-3-haiku': anthropic('claude-3-haiku-20240307'),
  },
};
```

#### タスク3.2: クイズ生成ツールの実装
```typescript
// src/mastra/tools/quiz-generator.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';

const QuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  codeSnippet: z.string().optional(),
});

export const generateQuizFromPR = createTool({
  id: 'generate-quiz-from-pr',
  name: 'Generate Quiz from PR',
  description: 'Generate educational quiz questions from PR data',
  inputSchema: z.object({
    prData: z.object({
      title: z.string(),
      description: z.string(),
      files: z.array(z.any()),
      commits: z.array(z.any()),
    }),
    options: z.object({
      questionCount: z.number().default(5),
      difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
      focusAreas: z.array(z.string()).optional(),
      language: z.enum(['ja', 'en']).default('ja'),
    }),
  }),
  outputSchema: z.object({
    title: z.string(),
    description: z.string(),
    questions: z.array(QuestionSchema),
    metadata: z.object({
      totalQuestions: z.number(),
      difficulty: z.string(),
      categories: z.array(z.string()),
      generatedAt: z.string(),
    }),
  }),
  execute: async ({ inputData, model }) => {
    const { prData, options } = inputData;
    
    // プロンプトの構築
    const systemPrompt = buildSystemPrompt(options.language, options.difficulty);
    const userPrompt = buildUserPrompt(prData, options);
    
    // LLMを使用してクイズ生成
    const response = await model.generateObject({
      model: model,
      system: systemPrompt,
      prompt: userPrompt,
      schema: z.object({
        questions: z.array(QuestionSchema),
      }),
    });
    
    return {
      title: `${prData.title}のクイズ`,
      description: `このクイズは、PR「${prData.title}」の変更内容に基づいて生成されました。`,
      questions: response.object.questions,
      metadata: {
        totalQuestions: response.object.questions.length,
        difficulty: options.difficulty,
        categories: [...new Set(response.object.questions.map(q => q.category))],
        generatedAt: new Date().toISOString(),
      },
    };
  },
});

function buildSystemPrompt(language: string, difficulty: string): string {
  return language === 'ja' 
    ? `あなたはプログラミング教育の専門家です。GitHubのPull Requestの変更内容を分析し、開発者の理解を深めるための教育的なクイズを作成してください。
       難易度は${difficulty}レベルで、実践的な知識を問う問題を作成してください。`
    : `You are a programming education expert. Analyze GitHub Pull Request changes and create educational quizzes to deepen developers' understanding.
       Create questions at ${difficulty} level that test practical knowledge.`;
}

function buildUserPrompt(prData: any, options: any): string {
  // PRデータから重要な変更点を抽出してプロンプトを構築
  return `
    PR Title: ${prData.title}
    PR Description: ${prData.description}
    
    Files Changed: ${prData.files.length}
    Total Additions: ${prData.files.reduce((acc: number, f: any) => acc + f.additions, 0)}
    Total Deletions: ${prData.files.reduce((acc: number, f: any) => acc + f.deletions, 0)}
    
    Generate ${options.questionCount} quiz questions based on these changes.
    Focus areas: ${options.focusAreas?.join(', ') || 'All areas'}
  `;
}
```

### フェーズ4: ワークフローの実装（優先度: 高）

#### タスク4.1: クイズ生成ワークフローの作成
```typescript
// src/mastra/workflows/quiz-generation.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { getPullRequestDetails } from '../tools/github-pr-fetcher';
import { generateQuizFromPR } from '../tools/quiz-generator';
import { sanitizePatchData } from '../tools/sanitizer';

const fetchPRStep = createStep({
  id: 'fetch-pr',
  inputSchema: z.object({
    prUrl: z.string().url(),
  }),
  outputSchema: z.object({
    prData: z.any(),
  }),
  execute: async ({ inputData, tools }) => {
    const prData = await tools.getPullRequestDetails.execute({
      prUrl: inputData.prUrl,
    });
    return { prData };
  },
});

const sanitizeDataStep = createStep({
  id: 'sanitize-data',
  inputSchema: z.object({
    prData: z.any(),
  }),
  outputSchema: z.object({
    sanitizedData: z.any(),
  }),
  execute: async ({ inputData, tools }) => {
    const sanitizedData = await tools.sanitizePatchData.execute({
      data: inputData.prData,
    });
    return { sanitizedData };
  },
});

const generateQuizStep = createStep({
  id: 'generate-quiz',
  inputSchema: z.object({
    sanitizedData: z.any(),
    options: z.object({
      questionCount: z.number(),
      difficulty: z.string(),
      language: z.string(),
    }),
  }),
  outputSchema: z.object({
    quiz: z.any(),
  }),
  execute: async ({ inputData, tools }) => {
    const quiz = await tools.generateQuizFromPR.execute({
      prData: inputData.sanitizedData,
      options: inputData.options,
    });
    return { quiz };
  },
});

export const quizGenerationWorkflow = createWorkflow({
  id: 'quiz-generation-workflow',
  name: 'Quiz Generation Workflow',
  description: 'Generate educational quiz from GitHub PR',
  inputSchema: z.object({
    prUrl: z.string().url(),
    options: z.object({
      questionCount: z.number().default(5),
      difficulty: z.string().default('mixed'),
      language: z.string().default('ja'),
    }),
  }),
  outputSchema: z.object({
    quiz: z.any(),
  }),
  steps: [fetchPRStep, sanitizeDataStep, generateQuizStep],
})
  .then(fetchPRStep)
  .then(sanitizeDataStep)
  .then(generateQuizStep)
  .commit();
```

### フェーズ5: エージェントの実装（優先度: 中）

#### タスク5.1: クイズ生成エージェントの作成
```typescript
// src/mastra/agents/quiz-generator.ts
import { Agent } from '@mastra/core';
import { models } from '../models';
import { getPullRequestDetails } from '../tools/github-pr-fetcher';
import { generateQuizFromPR } from '../tools/quiz-generator';
import { quizGenerationWorkflow } from '../workflows/quiz-generation';

export const quizGeneratorAgent = new Agent({
  name: 'quiz-generator-agent',
  instructions: `
    あなたはGitHub Pull Requestから教育的なプログラミングクイズを生成する専門家です。
    
    あなたの役割：
    1. PRの変更内容を詳細に分析する
    2. 開発者の学習に役立つ実践的な問題を作成する
    3. 適切な難易度とカテゴリーで問題を分類する
    4. 明確で教育的な解説を提供する
    
    重要な指針：
    - コードの変更意図を理解し、それに基づいた問題を作成する
    - 実装の詳細だけでなく、設計原則やベストプラクティスも問う
    - 日本語で回答する場合は、技術用語は適切に使用しつつ、わかりやすい説明を心がける
  `,
  model: models.openai['gpt-4-turbo'],
  tools: [getPullRequestDetails, generateQuizFromPR],
  workflows: [quizGenerationWorkflow],
});
```

### フェーズ6: Mastraインスタンスの初期化（優先度: 高）

#### タスク6.1: Mastra設定ファイルの作成
```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { githubIntegration } from './integrations/github';
import { quizGeneratorAgent } from './agents/quiz-generator';
import { quizGenerationWorkflow } from './workflows/quiz-generation';
import * as tools from './tools';

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
  logger: new PinoLogger({
    name: 'PR-Quiz-Generator',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
  db: {
    type: 'sqlite',
    path: './data/mastra.db',
  },
});
```

### フェーズ7: APIエンドポイントの実装（優先度: 高）

#### タスク7.1: Next.js APIルートの作成
```typescript
// src/app/api/quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { mastra } from '@/mastra';
import { z } from 'zod';

const RequestSchema = z.object({
  prUrl: z.string().url(),
  options: z.object({
    questionCount: z.number().min(1).max(20).default(5),
    difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
    language: z.enum(['ja', 'en']).default('ja'),
    provider: z.enum(['openai', 'google', 'anthropic']).default('openai'),
    model: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);
    
    // ワークフローの実行
    const result = await mastra.workflows.quizGeneration.execute({
      input: {
        prUrl: validatedData.prUrl,
        options: validatedData.options || {},
      },
      executionId: `quiz-${Date.now()}`,
    });
    
    return NextResponse.json({
      success: true,
      data: result.output.quiz,
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Quiz generation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // ワークフロー実行履歴の取得
  const executions = await mastra.db.workflows.getExecutions({
    workflowId: 'quiz-generation-workflow',
    limit: 10,
  });
  
  return NextResponse.json({
    success: true,
    data: executions,
  });
}
```

### フェーズ8: UIコンポーネントの更新（優先度: 中）

#### タスク8.1: React Hookの作成
```typescript
// src/hooks/useMastraQuiz.ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

export function useMastraQuiz() {
  const [quiz, setQuiz] = useState(null);
  
  const generateQuiz = useMutation({
    mutationFn: async (params: {
      prUrl: string;
      options?: any;
    }) => {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setQuiz(data.data);
    },
  });
  
  return {
    quiz,
    generateQuiz,
    isLoading: generateQuiz.isPending,
    error: generateQuiz.error,
  };
}
```

### フェーズ9: 評価システムの実装（優先度: 低）

#### タスク9.1: Mastra Evalsの設定
```typescript
// src/mastra/evals/quiz-quality.ts
import { createEval } from '@mastra/core';
import { z } from 'zod';

export const quizQualityEval = createEval({
  id: 'quiz-quality',
  name: 'Quiz Quality Evaluation',
  description: 'Evaluate the quality of generated quiz questions',
  inputSchema: z.object({
    quiz: z.any(),
    prData: z.any(),
  }),
  scoreSchema: z.object({
    relevance: z.number().min(0).max(1),
    difficulty: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    educational: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  evaluate: async ({ input, model }) => {
    // LLMを使用してクイズの品質を評価
    const evaluation = await model.generateObject({
      model: model,
      prompt: `
        Evaluate the quality of this quiz based on the PR data:
        
        Quiz: ${JSON.stringify(input.quiz)}
        PR Data: ${JSON.stringify(input.prData)}
        
        Score each aspect from 0 to 1:
        - relevance: How relevant are the questions to the PR changes?
        - difficulty: Is the difficulty appropriate?
        - clarity: Are the questions clear and unambiguous?
        - educational: Do the questions promote learning?
      `,
      schema: z.object({
        relevance: z.number(),
        difficulty: z.number(),
        clarity: z.number(),
        educational: z.number(),
      }),
    });
    
    const scores = evaluation.object;
    const overall = (scores.relevance + scores.difficulty + scores.clarity + scores.educational) / 4;
    
    return {
      ...scores,
      overall,
    };
  },
});
```

### フェーズ10: デプロイメント設定（優先度: 低）

#### タスク10.1: 環境変数の設定
```env
# .env.local
# GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_TOKEN=your_github_token

# LLM Providers
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Mastra
MASTRA_LOG_LEVEL=debug
MASTRA_DB_PATH=./data/mastra.db
```

#### タスク10.2: Dockerファイルの作成
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## 3. 移行戦略

### 段階的移行アプローチ

1. **第1段階**: Mastraプロジェクトのセットアップと基本的なツール実装
2. **第2段階**: GitHub統合とワークフロー実装
3. **第3段階**: 既存UIの接続とテスト
4. **第4段階**: エージェントと高度な機能の追加
5. **第5段階**: 本番環境へのデプロイ

### データ移行

- 既存のクイズ履歴データをMastraのDBに移行
- ユーザー設定の移行
- APIキーと認証情報の安全な移行

## 4. テスト計画

### ユニットテスト
```typescript
// src/mastra/tools/__tests__/github-pr-fetcher.test.ts
import { getPullRequestDetails } from '../github-pr-fetcher';

describe('GitHub PR Fetcher', () => {
  it('should fetch PR details correctly', async () => {
    const result = await getPullRequestDetails.execute({
      prUrl: 'https://github.com/owner/repo/pull/123',
    });
    
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('files');
    expect(result.files).toBeInstanceOf(Array);
  });
});
```

### 統合テスト
```typescript
// src/mastra/workflows/__tests__/quiz-generation.test.ts
import { quizGenerationWorkflow } from '../quiz-generation';

describe('Quiz Generation Workflow', () => {
  it('should generate quiz from PR URL', async () => {
    const result = await quizGenerationWorkflow.execute({
      input: {
        prUrl: 'https://github.com/test/repo/pull/1',
        options: {
          questionCount: 5,
          difficulty: 'medium',
          language: 'ja',
        },
      },
    });
    
    expect(result.output.quiz).toHaveProperty('questions');
    expect(result.output.quiz.questions).toHaveLength(5);
  });
});
```

## 5. パフォーマンス最適化

### キャッシング戦略
- GitHub API応答のキャッシング
- 生成されたクイズのキャッシング
- LLM応答のキャッシング

### スケーラビリティ
- ワークフローの並列実行
- バックグラウンドジョブの実装
- レート制限の実装

## 6. 監視とロギング

### OpenTelemetryの設定
```typescript
// src/mastra/telemetry.ts
import { MastraTelemetry } from '@mastra/core';

export const telemetry = new MastraTelemetry({
  serviceName: 'pr-quiz-generator',
  exporters: ['console', 'otlp'],
  samplingRate: 1.0,
});
```

## 7. 完了基準

- [ ] すべてのツールが実装され、テストされている
- [ ] ワークフローが正常に動作する
- [ ] UIが新しいAPIと統合されている
- [ ] ドキュメントが更新されている
- [ ] パフォーマンステストが完了している
- [ ] セキュリティレビューが完了している

## まとめ

このMastra実装により、PR Quiz Generatorは以下の利点を得られます：

1. **堅牢性の向上**: ワークフローベースの処理により、エラーハンドリングとリトライが改善
2. **拡張性の向上**: 新しいツールやワークフローを簡単に追加可能
3. **保守性の向上**: 宣言的なコードにより、理解とメンテナンスが容易
4. **可観測性の向上**: 組み込みのロギングとトレーシング
5. **統合の簡素化**: Mastraの統合パターンによりサードパーティサービスとの連携が容易

実装は段階的に進め、各フェーズでテストとレビューを実施することで、安全で確実な移行を実現します。