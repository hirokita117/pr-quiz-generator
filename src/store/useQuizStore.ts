import { create } from 'zustand';
import type { Quiz, QuizConfig, UIState, AIProvider, PullRequest, GenerateOptions } from '@/types';
import { env } from '@/utils/env';
import { githubService } from '@/services/github';
import { QuizGenerator } from '@/services/ai';

interface QuizStore extends UIState {
  // Additional state for task-2
  pullRequestUrl: string;
  pullRequest: PullRequest | null;
  
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  updateConfig: (config: Partial<QuizConfig>) => void;
  setPullRequestUrl: (url: string) => void;
  setPullRequest: (pr: PullRequest | null) => void;
  generateQuiz: (prUrl: string, options?: GenerateOptions) => Promise<void>;
  reset: () => void;
}

// ローカルストレージから設定をハイドレート
function readLocalStorage(key: string): string | undefined {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      const v = window.localStorage.getItem(key);
      return v ?? undefined;
    }
  } catch (error) {
    // localStorage の制限やブラウザ設定により失敗する場合がある
    console.warn('Failed to read from localStorage:', error);
  }
  return undefined;
}

const savedOpenaiKey = readLocalStorage('pr-quiz-openai-key');
const savedGoogleKey = readLocalStorage('pr-quiz-google-key');
const savedGoogleModel = readLocalStorage('pr-quiz-google-model');
const savedLocalEndpoint = readLocalStorage('pr-quiz-local-endpoint');
const savedLocalModel = readLocalStorage('pr-quiz-local-model');

const initialConfig: QuizConfig = {
  aiProvider: env.app.defaultAIProvider as AIProvider,
  questionCount: env.app.defaultQuestionCount,
  difficulty: env.app.defaultDifficulty as 'easy' | 'medium' | 'hard' | 'mixed',
  googleModel: savedGoogleModel || env.google.model,
  apiKeys: {
    ...(savedOpenaiKey ? { openai: savedOpenaiKey } : {}),
    ...(savedGoogleKey ? { google: savedGoogleKey } : {}),
  },
  localLLM: {
    endpoint: savedLocalEndpoint || env.localLLM.endpoint,
    model: savedLocalModel || env.localLLM.model,
  },
  cache: {
    enabled: env.cache.enabled,
    ttl: env.cache.ttl,
    maxSize: env.cache.maxSize,
  },
};

const initialState: UIState & { pullRequestUrl: string; pullRequest: PullRequest | null } = {
  isLoading: false,
  error: null,
  currentQuiz: null,
  config: initialConfig,
  pullRequestUrl: '',
  pullRequest: null,
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  ...initialState,
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  setCurrentQuiz: (quiz) => set({ currentQuiz: quiz, error: null }),
  
  updateConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig },
    })),
  
  setPullRequestUrl: (url) => set({ pullRequestUrl: url }),
  
  setPullRequest: (pr) => set({ pullRequest: pr }),
  
  generateQuiz: async (prUrl: string, options?: GenerateOptions) => {
    const state = get();
    const startTime = Date.now(); // 処理開始時間を記録
    
    try {
      set({ isLoading: true, error: null, pullRequestUrl: prUrl });
      
      // GitHub APIからPR情報を取得
      const pullRequest = await githubService.parsePullRequest(prUrl);
      set({ pullRequest });
      
      // APIキーが設定されているかチェック
      const config = state.config;
      if (!config.apiKeys?.openai && !config.apiKeys?.google && !config.localLLM) {
        throw new Error('AIプロバイダーのAPIキーまたはローカルLLMの設定が必要です');
      }
      
      // クイズ生成
      const generator = new QuizGenerator(config);
      const context = generator.buildContext(pullRequest, options);
      const questions = await generator.generateQuestions(context);
      
      // 処理時間を計算
      const processingTime = Date.now() - startTime;
      
      // クイズオブジェクトを構築
      const quiz: Quiz = {
        id: `quiz-${Date.now()}`,
        pullRequestUrl: prUrl,
        questions,
        metadata: {
          generatedBy: 'PR Quiz Generator',
          aiProvider: config.aiProvider,
          processingTime,
          complexity: context.complexity,
          focusAreas: context.focusAreas,
        },
        createdAt: new Date(),
      };
      
      set({ currentQuiz: quiz, isLoading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'クイズの生成中にエラーが発生しました';
      set({ 
        error: errorMessage,
        isLoading: false 
      });
    }
  },
  
  reset: () => set(initialState),
}));
