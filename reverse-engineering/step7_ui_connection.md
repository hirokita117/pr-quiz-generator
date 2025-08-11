# ステップ7: UIの接続

この最終ステップでは、既存のReactフロントエンドを、新しく作成したMastraベースのAPIエンドポイントに接続します。`zustand` のストアロジックを簡素化し、代わりにReact Query (`@tanstack/react-query`) などを使用してAPI通信を管理するのが推奨されます。

## タスクリスト

- [ ] APIリクエストを行うためのカスタムフックを作成する
- [ ] 既存のUIコンポーネントを修正し、新しいカスタムフックを使用する
- [ ] `zustand` ストアからビジネスロジックを削除し、UI状態管理に特化させる

## 詳細

### 1. API通信用のカスタムフックの作成 (`useMastraQuiz`)

API呼び出し、ローディング状態、エラーハンドリングをカプセル化したカスタムフックを作成します。これにより、コンポーネントの関心事を分離できます。

**ファイル:** `src/hooks/useMastraQuiz.ts`
```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// APIリクエストのパラメータの型定義
interface GenerateQuizParams {
  prUrl: string;
  options?: {
    questionCount?: number;
    language?: 'ja' | 'en';
    // 他のオプション
  };
}

// APIレスポンスの型定義（期待されるクイズの型）
interface QuizData {
  // ... クイズデータの構造
}

// クイズを生成するAPI関数
async function generateQuizAPI(params: GenerateQuizParams): Promise<QuizData> {
  const response = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate quiz');
  }
  
  const result = await response.json();
  return result.data;
}

// カスタムフック
export function useMastraQuiz() {
  const queryClient = useQueryClient();

  const mutation = useMutation<QuizData, Error, GenerateQuizParams>({
    mutationFn: generateQuizAPI,
    onSuccess: (data) => {
      // 成功した場合、zustandストアを更新するか、
      // もしくはこのフックが返すstateを更新する
      // 例: queryClient.setQueryData(['quiz'], data);
    },
  });

  return {
    generateQuiz: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    quizData: mutation.data,
  };
}
```

### 2. UIコンポーネントの修正

`PRUrlInput.tsx` や `App.tsx` などのコンポーネントで、`useMastraQuiz` フックを使用するように変更します。

```tsx
// src/components/PRUrlInput.tsx (抜粋)
import { useMastraQuiz } from '@/hooks/useMastraQuiz';

function PRUrlInput() {
  const [url, setUrl] = useState('');
  const { generateQuiz, isLoading, error } = useMastraQuiz();

  const handleSubmit = () => {
    if (url) {
      generateQuiz({ prUrl: url });
    }
  };

  return (
    <div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} />
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Quiz'}
      </button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### 3. `zustand` ストアのリファクタリング

`useQuizStore.ts` から、`generateQuiz` アクション内の複雑なビジネスロジック（GitHub API呼び出し、AI呼び出しなど）を削除します。ストアは、生成されたクイズデータやUIの表示状態など、純粋なUI状態の管理に集中するようにします。

```typescript
// src/store/useQuizStore.ts (リファクタリング後)
import { create } from 'zustand';

interface QuizState {
  quiz: QuizData | null;
  setQuiz: (quiz: QuizData | null) => void;
  // 他のUI状態...
}

export const useQuizStore = create<QuizState>((set) => ({
  quiz: null,
  setQuiz: (quiz) => set({ quiz }),
}));

// useMastraQuizフックのonSuccess内で setQuiz を呼び出して状態を更新する
```

このリファクタリングにより、フロントエンドのコードはバックエンドの実装から完全に分離され、Mastraへの移行が完了します。
