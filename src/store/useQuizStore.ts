import { create } from 'zustand';
import { Quiz, QuizConfig, UIState, AIProvider } from '@/types';
import { env } from '@/utils/env';

interface QuizStore extends UIState {
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  updateConfig: (config: Partial<QuizConfig>) => void;
  reset: () => void;
}

const initialConfig: QuizConfig = {
  aiProvider: env.app.defaultAIProvider as AIProvider,
  questionCount: env.app.defaultQuestionCount,
  difficulty: env.app.defaultDifficulty as 'easy' | 'medium' | 'hard' | 'mixed',
  cache: {
    enabled: env.cache.enabled,
    ttl: env.cache.ttl,
    maxSize: env.cache.maxSize,
  },
};

const initialState: UIState = {
  isLoading: false,
  error: null,
  currentQuiz: null,
  config: initialConfig,
};

export const useQuizStore = create<QuizStore>((set) => ({
  ...initialState,
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error, isLoading: false }),
  
  setCurrentQuiz: (quiz) => set({ currentQuiz: quiz, error: null }),
  
  updateConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig },
    })),
  
  reset: () => set(initialState),
}));
