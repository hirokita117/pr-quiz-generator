// GitHub関連の型定義
export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  author: string;
  repository: {
    owner: string;
    name: string;
  };
  files: PRFile[];
  commits: Commit[];
  reviews: Review[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  language?: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
}

export interface Review {
  id: string;
  user: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  body: string;
  submittedAt: Date;
}

// クイズ関連の型定義
export interface Quiz {
  id: string;
  pullRequestUrl: string;
  questions: Question[];
  metadata: QuizMetadata;
  createdAt: Date;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'code-review' | 'explanation';
  content: string;
  code?: CodeSnippet;
  options?: QuestionOption[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface CodeSnippet {
  language: string;
  content: string;
  filename?: string;
  startLine?: number;
  endLine?: number;
}

export interface QuizMetadata {
  generatedBy: string;
  aiProvider: AIProvider;
  processingTime: number;
  complexity: number;
  focusAreas: FocusArea[];
}

// 設定関連の型定義
export interface QuizConfig {
  aiProvider: AIProvider;
  apiKeys?: {
    openai?: string;
    google?: string;
  };
  localLLM?: LocalLLMConfig;
  cache?: CacheConfig;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusAreas?: FocusArea[];
}

export type AIProvider = 'openai' | 'google' | 'local';

export interface LocalLLMConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number;
}

export interface FocusArea {
  type: 'logic' | 'syntax' | 'best-practices' | 'security' | 'performance';
  weight: number;
}

// 生成オプション
export interface GenerateOptions {
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusAreas?: FocusArea[];
  excludeFiles?: string[];
  includeOnlyFiles?: string[];
}

// API関連の型定義
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

// UI状態の型定義
export interface UIState {
  isLoading: boolean;
  error: string | null;
  currentQuiz: Quiz | null;
  config: QuizConfig;
}

// ユーティリティ型
export type PRUrl = string;
export type QuizId = string;
export type QuestionId = string;
