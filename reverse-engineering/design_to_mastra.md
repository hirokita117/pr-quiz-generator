# GitHubプルリクエストクイズ生成システム - Mastra実装仕様書

## 1. プロジェクト概要

### 1.1 目的
パブリックなGitHubプルリクエストから学習用クイズを自動生成するローカル実行型システムの構築

### 1.2 技術スタック
- **フレームワーク**: Mastra (TypeScript)
- **LLMプロバイダー**: Google Gemini (固定)
- **UI**: React + Vite + Tailwind CSS
- **GitHub API**: Octokit
- **実行環境**: ローカルマシンのみ

## 2. プロジェクト構造

```
github-pr-quiz/
├── src/
│   ├── agents/
│   │   └── quiz-generator-agent.ts
│   ├── tools/
│   │   ├── github-pr-tool.ts
│   │   ├── diff-analyzer-tool.ts
│   │   └── quiz-formatter-tool.ts
│   ├── workflows/
│   │   └── pr-quiz-workflow.ts
│   ├── config/
│   │   ├── gemini-config.ts
│   │   └── quiz-settings.ts
│   ├── types/
│   │   ├── github.types.ts
│   │   └── quiz.types.ts
│   ├── utils/
│   │   ├── github-url-parser.ts
│   │   ├── diff-parser.ts
│   │   └── cache-manager.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── URLInput.tsx
│   │   │   ├── QuizDisplay.tsx
│   │   │   ├── QuizAnswer.tsx
│   │   │   └── ResultDisplay.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── index.ts
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── README.md
```

## 3. Phase 1: 環境構築とプロジェクトセットアップ

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

## 4. Phase 2: 型定義

### 4.1 GitHub型定義 (src/types/github.types.ts)

```typescript
export interface ParsedPRUrl {
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface PRInfo {
  title: string;
  description: string;
  author: string;
  baseRef: string;
  headRef: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  state: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
}

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  previousFilename?: string;
}

export interface DiffAnalysis {
  summary: string;
  changeType: 'bug_fix' | 'feature' | 'refactor' | 'documentation' | 'test' | 'other';
  impactLevel: 'low' | 'medium' | 'high';
  keyChanges: string[];
  filesAnalyzed: number;
}
```

### 4.2 クイズ型定義 (src/types/quiz.types.ts)

```typescript
export type QuizType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'open_ended';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  difficulty: DifficultyLevel;
  question: string;
  context?: string; // 関連するコードスニペット
  options?: string[]; // 選択式の場合
  correctAnswer: string | boolean | number;
  explanation: string;
  relatedFile?: string;
  lineNumbers?: { start: number; end: number };
}

export interface QuizSet {
  prUrl: string;
  prTitle: string;
  generatedAt: Date;
  questions: QuizQuestion[];
  metadata: {
    totalQuestions: number;
    difficultyDistribution: Record<DifficultyLevel, number>;
    typeDistribution: Record<QuizType, number>;
  };
}

export interface QuizResult {
  questionId: string;
  userAnswer: string | boolean;
  isCorrect: boolean;
  timeSpent: number; // ミリ秒
}

export interface QuizSession {
  quizSet: QuizSet;
  results: QuizResult[];
  startedAt: Date;
  completedAt?: Date;
  score: number;
  percentage: number;
}
```

## 5. Phase 3: ツール実装

### 5.1 GitHub PR取得ツール (src/tools/github-pr-tool.ts)

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { ParsedPRUrl, PRInfo, FileChange } from "@/types/github.types";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const githubPRTool = createTool({
  id: "fetch-github-pr",
  description: "Fetch pull request information and changes from GitHub",
  inputSchema: z.object({
    url: z.string().url().describe("GitHub PR URL"),
  }),
  outputSchema: z.object({
    prInfo: z.object({
      title: z.string(),
      description: z.string(),
      author: z.string(),
      baseRef: z.string(),
      headRef: z.string(),
      changedFiles: z.number(),
      additions: z.number(),
      deletions: z.number(),
      state: z.enum(['open', 'closed', 'merged']),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
    files: z.array(z.object({
      filename: z.string(),
      status: z.enum(['added', 'modified', 'removed', 'renamed']),
      additions: z.number(),
      deletions: z.number(),
      patch: z.string().optional(),
      previousFilename: z.string().optional(),
    })),
    diffContent: z.string(),
  }),
  execute: async ({ context }) => {
    const parsed = parsePRUrl(context.url);
    
    // PR基本情報の取得
    const { data: pr } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
    });
    
    // 変更ファイルの取得
    const { data: files } = await octokit.pulls.listFiles({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
      per_page: 100, // 最大100ファイル
    });
    
    // diffの取得
    const { data: diffData } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
      mediaType: { format: "diff" },
    });
    
    const prInfo: PRInfo = {
      title: pr.title,
      description: pr.body || "",
      author: pr.user?.login || "unknown",
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
      changedFiles: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
      state: pr.state === 'open' ? 'open' : pr.merged ? 'merged' : 'closed',
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
    };
    
    const fileChanges: FileChange[] = files.map(file => ({
      filename: file.filename,
      status: file.status as FileChange['status'],
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      previousFilename: file.previous_filename,
    }));
    
    return {
      prInfo,
      files: fileChanges,
      diffContent: diffData as unknown as string,
    };
  },
});

function parsePRUrl(url: string): ParsedPRUrl {
  const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error("Invalid GitHub PR URL format");
  }
  
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: parseInt(match[3], 10),
  };
}
```

### 5.2 Diff解析ツール (src/tools/diff-analyzer-tool.ts)

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import parseDiff from "parse-diff";
import type { DiffAnalysis } from "@/types/github.types";

export const diffAnalyzerTool = createTool({
  id: "analyze-diff",
  description: "Analyze PR diff to understand the nature of changes",
  inputSchema: z.object({
    diffContent: z.string(),
    files: z.array(z.object({
      filename: z.string(),
      status: z.string(),
      additions: z.number(),
      deletions: z.number(),
      patch: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    analysis: z.object({
      summary: z.string(),
      changeType: z.enum(['bug_fix', 'feature', 'refactor', 'documentation', 'test', 'other']),
      impactLevel: z.enum(['low', 'medium', 'high']),
      keyChanges: z.array(z.string()),
      filesAnalyzed: z.number(),
    }),
    parsedDiff: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const { diffContent, files } = context;
    
    // Diffのパース
    const parsedDiff = parseDiff(diffContent);
    
    // 変更タイプの推定
    const changeType = inferChangeType(files, parsedDiff);
    
    // 影響レベルの評価
    const impactLevel = assessImpactLevel(files);
    
    // 主要な変更点の抽出
    const keyChanges = extractKeyChanges(parsedDiff, files);
    
    const analysis: DiffAnalysis = {
      summary: generateSummary(files, changeType),
      changeType,
      impactLevel,
      keyChanges,
      filesAnalyzed: files.length,
    };
    
    return {
      analysis,
      parsedDiff,
    };
  },
});

function inferChangeType(files: any[], parsedDiff: any[]): DiffAnalysis['changeType'] {
  const filenames = files.map(f => f.filename.toLowerCase());
  
  // テストファイルの変更が主な場合
  if (filenames.some(f => f.includes('test') || f.includes('spec'))) {
    const testFiles = filenames.filter(f => f.includes('test') || f.includes('spec'));
    if (testFiles.length > files.length * 0.5) return 'test';
  }
  
  // ドキュメントの変更
  if (filenames.some(f => f.endsWith('.md') || f.includes('doc'))) {
    const docFiles = filenames.filter(f => f.endsWith('.md') || f.includes('doc'));
    if (docFiles.length > files.length * 0.5) return 'documentation';
  }
  
  // バグ修正の可能性（小規模な変更）
  const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (totalChanges < 50 && files.length <= 3) return 'bug_fix';
  
  // リファクタリング（削除が多い）
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  if (totalDeletions > totalAdditions * 0.8 && totalDeletions > 100) return 'refactor';
  
  // 新機能（追加が多い）
  if (totalAdditions > totalDeletions * 1.5) return 'feature';
  
  return 'other';
}

function assessImpactLevel(files: any[]): DiffAnalysis['impactLevel'] {
  const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const fileCount = files.length;
  
  if (totalChanges > 500 || fileCount > 10) return 'high';
  if (totalChanges > 100 || fileCount > 5) return 'medium';
  return 'low';
}

function extractKeyChanges(parsedDiff: any[], files: any[]): string[] {
  const keyChanges: string[] = [];
  
  // 各ファイルから主要な変更を抽出
  parsedDiff.forEach((file) => {
    if (file.chunks) {
      file.chunks.forEach((chunk: any) => {
        // 関数の追加/削除を検出
        const addedFunctions = chunk.changes
          .filter((c: any) => c.type === 'add' && c.content.includes('function'))
          .map((c: any) => `Added function in ${file.to}`);
        
        keyChanges.push(...addedFunctions.slice(0, 2));
      });
    }
  });
  
  // 新規ファイルの追加
  const newFiles = files.filter(f => f.status === 'added');
  newFiles.forEach(f => {
    keyChanges.push(`New file: ${f.filename}`);
  });
  
  return keyChanges.slice(0, 5); // 最大5個の主要変更
}

function generateSummary(files: any[], changeType: string): string {
  const fileCount = files.length;
  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  
  return `This PR contains ${fileCount} file(s) with ${additions} additions and ${deletions} deletions. The main change type appears to be: ${changeType}.`;
}
```

## 6. Phase 4: エージェント実装

### 6.1 Gemini設定 (src/config/gemini-config.ts)

```typescript
import { google } from "@ai-sdk/google";

export const geminiModel = google("gemini-1.5-flash", {
  safetySettings: [
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_NONE",
    },
  ],
});

export const geminiConfig = {
  temperature: 0.7,
  maxTokens: 4000,
  topP: 0.9,
};
```

### 6.2 クイズ生成エージェント (src/agents/quiz-generator-agent.ts)

```typescript
import { Agent } from "@mastra/core/agent";
import { geminiModel, geminiConfig } from "@/config/gemini-config";
import type { QuizQuestion, DifficultyLevel, QuizType } from "@/types/quiz.types";

export const quizGeneratorAgent = new Agent({
  name: "Quiz Generator",
  instructions: `
    You are an expert programming educator who creates insightful quiz questions based on GitHub pull request changes.
    
    Your task is to generate educational quiz questions that test understanding of:
    1. The purpose and impact of code changes
    2. Programming concepts demonstrated in the changes
    3. Best practices and potential improvements
    4. Edge cases and error handling
    
    Guidelines for quiz generation:
    - Create diverse question types (multiple choice, true/false, fill-in-the-blank, open-ended)
    - Vary difficulty levels based on the complexity of changes
    - Include code snippets when relevant
    - Provide clear, educational explanations for each answer
    - Focus on learning outcomes rather than trivial details
    - Questions should be in Japanese unless the code comments are in English
    
    For each question, provide:
    - A clear, unambiguous question
    - Correct answer with detailed explanation
    - For multiple choice: 3-4 plausible distractors
    - Context from the actual code when helpful
    - Difficulty assessment (beginner/intermediate/advanced)
  `,
  model: geminiModel,
  modelSettings: geminiConfig,
});

export async function generateQuizQuestions(
  prInfo: any,
  diffAnalysis: any,
  settings: {
    questionCount: number;
    difficulty?: DifficultyLevel;
    types?: QuizType[];
  }
): Promise<QuizQuestion[]> {
  const prompt = buildQuizPrompt(prInfo, diffAnalysis, settings);
  
  const response = await quizGeneratorAgent.generate(prompt);
  
  // レスポンスをパースしてQuizQuestion[]に変換
  return parseQuizResponse(response.text);
}

function buildQuizPrompt(prInfo: any, diffAnalysis: any, settings: any): string {
  return `
    Pull Request Information:
    - Title: ${prInfo.title}
    - Description: ${prInfo.description}
    - Files Changed: ${prInfo.changedFiles}
    - Change Type: ${diffAnalysis.changeType}
    - Impact Level: ${diffAnalysis.impactLevel}
    
    Key Changes:
    ${diffAnalysis.keyChanges.join('\n')}
    
    Generate ${settings.questionCount} quiz questions based on these changes.
    ${settings.difficulty ? `Focus on ${settings.difficulty} level questions.` : 'Include a mix of difficulty levels.'}
    ${settings.types ? `Use these question types: ${settings.types.join(', ')}` : 'Use various question types.'}
    
    Return the questions in the following JSON format:
    {
      "questions": [
        {
          "type": "multiple_choice|true_false|fill_blank|open_ended",
          "difficulty": "beginner|intermediate|advanced",
          "question": "質問文",
          "options": ["選択肢1", "選択肢2", ...] (multiple_choiceの場合のみ),
          "correctAnswer": "正解",
          "explanation": "解説",
          "context": "関連するコードスニペット（オプション）",
          "relatedFile": "関連ファイル名（オプション）"
        }
      ]
    }
  `;
}

function parseQuizResponse(responseText: string): QuizQuestion[] {
  try {
    // JSON部分を抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // IDを付与して返す
    return parsed.questions.map((q: any, index: number) => ({
      id: `q_${Date.now()}_${index}`,
      ...q,
    }));
  } catch (error) {
    console.error("Failed to parse quiz response:", error);
    throw new Error("クイズの生成に失敗しました");
  }
}
```

## 7. Phase 5: ワークフロー実装

### 7.1 メインワークフロー (src/workflows/pr-quiz-workflow.ts)

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { githubPRTool } from "@/tools/github-pr-tool";
import { diffAnalyzerTool } from "@/tools/diff-analyzer-tool";
import { generateQuizQuestions } from "@/agents/quiz-generator-agent";
import type { QuizSet } from "@/types/quiz.types";

// Step 1: PR情報取得
const fetchPRStep = createStep({
  id: "fetch-pr",
  description: "Fetch GitHub PR information",
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    prInfo: z.any(),
    files: z.array(z.any()),
    diffContent: z.string(),
  }),
  execute: async ({ context }) => {
    const result = await githubPRTool.execute({ context });
    return result;
  },
});

// Step 2: Diff解析
const analyzeDiffStep = createStep({
  id: "analyze-diff",
  description: "Analyze PR diff content",
  inputSchema: z.object({
    diffContent: z.string(),
    files: z.array(z.any()),
  }),
  outputSchema: z.object({
    analysis: z.any(),
    parsedDiff: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const result = await diffAnalyzerTool.execute({ context });
    return result;
  },
});

// Step 3: クイズ生成
const generateQuizStep = createStep({
  id: "generate-quiz",
  description: "Generate quiz questions",
  inputSchema: z.object({
    prInfo: z.any(),
    analysis: z.any(),
    settings: z.object({
      questionCount: z.number().default(5),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    }),
  }),
  outputSchema: z.object({
    questions: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const questions = await generateQuizQuestions(
      context.prInfo,
      context.analysis,
      context.settings
    );
    return { questions };
  },
});

// Step 4: クイズセット作成
const createQuizSetStep = createStep({
  id: "create-quiz-set",
  description: "Create final quiz set",
  inputSchema: z.object({
    url: z.string(),
    prInfo: z.any(),
    questions: z.array(z.any()),
  }),
  outputSchema: z.object({
    quizSet: z.any(),
  }),
  execute: async ({ context }) => {
    const { url, prInfo, questions } = context;
    
    // 難易度とタイプの分布を計算
    const difficultyDistribution = questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const typeDistribution = questions.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const quizSet: QuizSet = {
      prUrl: url,
      prTitle: prInfo.title,
      generatedAt: new Date(),
      questions,
      metadata: {
        totalQuestions: questions.length,
        difficultyDistribution,
        typeDistribution,
      },
    };
    
    return { quizSet };
  },
});

// ワークフローの定義
export const prQuizWorkflow = createWorkflow({
  id: "pr-quiz-generation",
  description: "Generate quiz from GitHub PR",
  inputSchema: z.object({
    url: z.string().url(),
    settings: z.object({
      questionCount: z.number().default(5),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    quizSet: z.any(),
  }),
})
  .then(fetchPRStep)
  .then(({ prInfo, files, diffContent }) => 
    analyzeDiffStep.run({ diffContent, files })
      .then(({ analysis, parsedDiff }) => ({
        prInfo,
        files,
        analysis,
        parsedDiff,
      }))
  )
  .then(({ prInfo, analysis }) => 
    generateQuizStep.run({
      prInfo,
      analysis,
      settings: { questionCount: 5 },
    })
      .then(({ questions }) => ({
        prInfo,
        questions,
      }))
  )
  .then(({ prInfo, questions }) =>
    createQuizSetStep.run({
      url: prInfo.url,
      prInfo,
      questions,
    })
  );

// ワークフローをコミット
prQuizWorkflow.commit();
```

## 8. Phase 6: UI実装

### 8.1 メインApp (src/ui/App.tsx)

```typescript
import React, { useState } from 'react';
import { URLInput } from './components/URLInput';
import { QuizDisplay } from './components/QuizDisplay';
import { QuizAnswer } from './components/QuizAnswer';
import { ResultDisplay } from './components/ResultDisplay';
import type { QuizSet, QuizSession } from '@/types/quiz.types';

type AppState = 'input' | 'loading' | 'quiz' | 'result';

export default function App() {
  const [appState, setAppState] = useState<AppState>('input');
  const [quizSet, setQuizSet] = useState<QuizSet | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQuiz = async (url: string, settings: any) => {
    setAppState('loading');
    setError(null);
    
    try {
      const response = await fetch('/api/workflows/pr-quiz-generation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, settings }),
      });
      
      if (!response.ok) {
        throw new Error('クイズの生成に失敗しました');
      }
      
      const data = await response.json();
      setQuizSet(data.quizSet);
      
      // セッション初期化
      setSession({
        quizSet: data.quizSet,
        results: [],
        startedAt: new Date(),
        score: 0,
        percentage: 0,
      });
      
      setAppState('quiz');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setAppState('input');
    }
  };

  const handleAnswer = (answer: string | boolean, timeSpent: number) => {
    if (!session || !quizSet) return;
    
    const currentQuestion = quizSet.questions[currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;
    
    const newResult = {
      questionId: currentQuestion.id,
      userAnswer: answer,
      isCorrect,
      timeSpent,
    };
    
    const updatedResults = [...session.results, newResult];
    const score = updatedResults.filter(r => r.isCorrect).length;
    const percentage = (score / quizSet.questions.length) * 100;
    
    setSession({
      ...session,
      results: updatedResults,
      score,
      percentage,
    });
    
    if (currentQuestionIndex < quizSet.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // クイズ完了
      setSession({
        ...session,
        results: updatedResults,
        completedAt: new Date(),
        score,
        percentage,
      });
      setAppState('result');
    }
  };

  const handleRestart = () => {
    setQuizSet(null);
    setSession(null);
    setCurrentQuestionIndex(0);
    setAppState('input');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            GitHub PR クイズジェネレーター
          </h1>
          <p className="mt-2 text-gray-600">
            プルリクエストから学習クイズを自動生成
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {appState === 'input' && (
            <URLInput onSubmit={handleGenerateQuiz} error={error} />
          )}
          
          {appState === 'loading' && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">クイズを生成中...</p>
            </div>
          )}
          
          {appState === 'quiz' && quizSet && session && (
            <div>
              <QuizDisplay
                question={quizSet.questions[currentQuestionIndex]}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={quizSet.questions.length}
              />
              <QuizAnswer
                question={quizSet.questions[currentQuestionIndex]}
                onAnswer={handleAnswer}
              />
            </div>
          )}
          
          {appState === 'result' && session && (
            <ResultDisplay
              session={session}
              onRestart={handleRestart}
            />
          )}
        </main>
      </div>
    </div>
  );
}
```

### 8.2 URL入力コンポーネント (src/ui/components/URLInput.tsx)

```typescript
import React, { useState } from 'react';

interface URLInputProps {
  onSubmit: (url: string, settings: any) => void;
  error: string | null;
}

export function URLInput({ onSubmit, error }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.includes('github.com') || !url.includes('/pull/')) {
      alert('有効なGitHub PR URLを入力してください');
      return;
    }
    
    const settings = {
      questionCount,
      ...(difficulty && { difficulty }),
    };
    
    onSubmit(url, settings);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">
            GitHub PR URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700">
              問題数
            </label>
            <select
              id="count"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={3}>3問</option>
              <option value={5}>5問</option>
              <option value={10}>10問</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700">
              難易度
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">混合</option>
              <option value="beginner">初級</option>
              <option value="intermediate">中級</option>
              <option value="advanced">上級</option>
            </select>
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-150"
        >
          クイズを生成
        </button>
      </form>
    </div>
  );
}
```

## 9. Phase 7: ユーティリティ実装

### 9.1 キャッシュマネージャー (src/utils/cache-manager.ts)

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 3600000; // 1時間

  constructor() {
    if (process.env.QUIZ_CACHE_TTL) {
      this.defaultTTL = parseInt(process.env.QUIZ_CACHE_TTL);
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (process.env.QUIZ_CACHE_ENABLED !== 'true') return;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get<T>(key: string): T | null {
    if (process.env.QUIZ_CACHE_ENABLED !== 'true') return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  // PR URLをキーに変換
  generatePRKey(url: string, settings?: any): string {
    const base = url.replace(/[^a-zA-Z0-9]/g, '_');
    const settingsKey = settings ? JSON.stringify(settings) : '';
    return `pr_${base}_${settingsKey}`;
  }
}

export const cacheManager = new CacheManager();
```

## 10. Phase 8: メインエントリーポイント

### 10.1 サーバー起動 (src/index.ts)

```typescript
import { Mastra } from "@mastra/core";
import { prQuizWorkflow } from "./workflows/pr-quiz-workflow";
import { quizGeneratorAgent } from "./agents/quiz-generator-agent";
import express from "express";
import { createServer } from "vite";

async function startServer() {
  // Mastraインスタンスの作成
  const mastra = new Mastra({
    workflows: [prQuizWorkflow],
    agents: [quizGeneratorAgent],
    serverPort: parseInt(process.env.MASTRA_SERVER_PORT || '4111'),
  });

  // Mastra APIの起動
  await mastra.start();
  console.log(`🚀 Mastra API running on http://localhost:${process.env.MASTRA_SERVER_PORT || '4111'}`);
  console.log(`🎮 Playground available at http://localhost:${process.env.MASTRA_SERVER_PORT || '4111'}/`);

  // Vite開発サーバーの起動（UI用）
  const app = express();
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const uiPort = 3000;
  app.listen(uiPort, () => {
    console.log(`🖥️  UI available at http://localhost:${uiPort}`);
  });
}

startServer().catch(console.error);
```

## 11. テスト仕様

### 11.1 単体テスト例 (tests/tools/github-pr-tool.test.ts)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { githubPRTool } from '@/tools/github-pr-tool';

describe('GitHub PR Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse valid GitHub PR URL', async () => {
    const url = 'https://github.com/facebook/react/pull/12345';
    const result = await githubPRTool.execute({
      context: { url },
    });
    
    expect(result.prInfo).toBeDefined();
    expect(result.files).toBeInstanceOf(Array);
  });

  it('should throw error for invalid URL', async () => {
    const url = 'https://example.com/invalid';
    
    await expect(githubPRTool.execute({
      context: { url },
    })).rejects.toThrow('Invalid GitHub PR URL format');
  });
});
```

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

## 13. エラーハンドリング

### 13.1 主要なエラーケース

1. **GitHub API制限**
   - レート制限に達した場合は適切なエラーメッセージを表示
   - GitHub Tokenを使用してレート制限を緩和

2. **Gemini API エラー**
   - APIキーの検証
   - トークン制限への対応
   - リトライ機能の実装

3. **大規模PR対応**
   - 100ファイル以上の変更がある場合の処理
   - diff内容の要約機能
   - 段階的な処理

4. **ネットワークエラー**
   - タイムアウト設定
   - 再試行メカニズム
   - オフライン時の適切なメッセージ

## 14. 今後の拡張可能性

- **データベース統合**: 生成したクイズの永続化
- **ユーザー管理**: 学習進捗の追跡
- **統計機能**: 正答率の分析
- **エクスポート機能**: クイズのPDF/Markdown出力
- **協調学習**: 複数ユーザーでのクイズ共有
- **カスタムプロンプト**: ユーザー定義のクイズ生成ルール

## 15. セキュリティ考慮事項

- APIキーは環境変数で管理
- ローカル実行のみのため外部アクセスなし
- PRコンテンツのサニタイゼーション
- XSS対策の実装
