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
