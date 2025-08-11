
import { useQuizStore } from '@/store/useQuizStore';
import { PRUrlInput } from '@/components/PRUrlInput';
import { SettingsPanel } from '@/components/SettingsPanel';
import { QuizDisplay } from '@/components/QuizDisplay';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';

function App() {
  const { isLoading, error, currentQuiz, generateQuiz, pullRequestUrl } = useQuizStore();

  const handleRetry = async () => {
    if (pullRequestUrl) {
      try {
        await generateQuiz(pullRequestUrl);
      } catch (error) {
        console.error('リトライ処理中にエラーが発生しました:', error);
        // エラー通知はuseQuizStore内のgenerateQuizが担当するため、ここではロギングのみ
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              PR Quiz Generator
            </h1>
            <p className="text-gray-600 mt-2">
              GitHub プルリクエストからクイズを生成するアプリケーション
            </p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左カラム: PRUrlInput と QuizDisplay */}
          <div className="lg:col-span-2 space-y-6">
            {/* PR URL入力 */}
            <PRUrlInput />

            {/* エラー表示 */}
            {error && (
              <ErrorMessage 
                error={error} 
                onRetry={handleRetry}
              />
            )}

            {/* ローディング表示 */}
            {isLoading && (
              <LoadingSpinner 
                message="プルリクエストからクイズを生成中..."
                detailed={true}
              />
            )}

            {/* クイズ表示 */}
            {currentQuiz && !isLoading && !error && (
              <QuizDisplay />
            )}

            {/* 初期状態のプレースホルダー */}
            {!currentQuiz && !isLoading && !error && (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    クイズを生成しましょう
                  </h3>
                  <p className="text-gray-500 mb-6">
                    上記にGitHub プルリクエストのURLを入力して、
                    AIが自動でクイズを生成します。
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>📝 コードレビューの練習に最適</p>
                    <p>🧠 理解度をチェックできます</p>
                    <p>⚡ 数秒でクイズが完成</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右カラム: SettingsPanel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <SettingsPanel />
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; 2024 PR Quiz Generator. All rights reserved.</p>
            <p className="mt-1">
              Powered by AI • Built with React & TypeScript
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
