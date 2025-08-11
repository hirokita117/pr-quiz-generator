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
