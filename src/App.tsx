
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/store/useQuizStore';

function App() {
  const { config } = useQuizStore();

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-center text-foreground">
          PR Quiz Generator
        </h1>
        <p className="text-center text-muted-foreground mt-2">
          GitHub プルリクエストからクイズを生成するアプリケーション
        </p>
        
        <div className="flex justify-center mt-8 space-x-4">
          <Button variant="default">
            クイズを生成
          </Button>
          <Button variant="outline">
            設定
          </Button>
        </div>
        
        <div className="mt-8 p-4 bg-card rounded-lg border">
          <h2 className="text-lg font-semibold text-card-foreground mb-2">
            現在の設定
          </h2>
          <p className="text-muted-foreground">
            AIプロバイダー: {config.aiProvider}
          </p>
          <p className="text-muted-foreground">
            質問数: {config.questionCount}
          </p>
          <p className="text-muted-foreground">
            難易度: {config.difficulty}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
