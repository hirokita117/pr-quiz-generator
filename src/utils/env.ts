// 環境変数の型安全な読み込み

export const env = {
  // GitHub設定
  github: {
    apiUrl: import.meta.env.VITE_GITHUB_API_URL || 'https://api.github.com',
    token: import.meta.env.VITE_GITHUB_TOKEN,
  },
  
  // OpenAI設定
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    apiUrl: import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1',
  },
  
  // Google AI設定
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    apiUrl: import.meta.env.VITE_GOOGLE_API_URL || 'https://generativelanguage.googleapis.com/v1',
  },
  
  // ローカルLLM設定
  localLLM: {
    endpoint: import.meta.env.VITE_LOCAL_LLM_ENDPOINT || 'http://localhost:11434',
    model: import.meta.env.VITE_LOCAL_LLM_MODEL || 'llama2',
  },
  
  // アプリケーション設定
  app: {
    title: import.meta.env.VITE_APP_TITLE || 'PR Quiz Generator',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    defaultAIProvider: import.meta.env.VITE_DEFAULT_AI_PROVIDER || 'openai',
    defaultQuestionCount: parseInt(import.meta.env.VITE_DEFAULT_QUESTION_COUNT || '10'),
    defaultDifficulty: import.meta.env.VITE_DEFAULT_DIFFICULTY || 'mixed',
  },
  
  // キャッシュ設定
  cache: {
    enabled: import.meta.env.VITE_CACHE_ENABLED === 'true',
    ttl: parseInt(import.meta.env.VITE_CACHE_TTL || '3600000'),
    maxSize: parseInt(import.meta.env.VITE_CACHE_MAX_SIZE || '100'),
  },
  
  // ログ設定
  log: {
    level: import.meta.env.VITE_LOG_LEVEL || 'info',
    debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  },
} as const;

// 環境変数の検証
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 必須の環境変数をチェック（開発環境では警告のみ）
  if (import.meta.env.PROD) {
    if (!env.github.token) {
      errors.push('VITE_GITHUB_TOKEN is required in production');
    }
    
    // AIプロバイダーのいずれかが設定されている必要がある
    const hasAIProvider = env.openai.apiKey || env.google.apiKey || env.localLLM.endpoint;
    if (!hasAIProvider) {
      errors.push('At least one AI provider must be configured');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 開発時のヘルパー関数
export function getEnvironmentInfo() {
  return {
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    config: env,
  };
}
