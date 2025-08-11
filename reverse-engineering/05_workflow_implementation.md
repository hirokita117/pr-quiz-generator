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
