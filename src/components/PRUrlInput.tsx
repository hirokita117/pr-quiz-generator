import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuizStore } from '@/store/useQuizStore';
import { Loader2, Github, CheckCircle2, XCircle } from 'lucide-react';
import { githubService } from '@/services/github';

export const PRUrlInput: React.FC = () => {
  const { 
    pullRequestUrl, 
    isLoading, 
    setPullRequestUrl, 
    generateQuiz 
  } = useQuizStore();
  
  const [inputValue, setInputValue] = useState(pullRequestUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testTitle, setTestTitle] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setPullRequestUrl(inputValue.trim());
      await generateQuiz(inputValue.trim());
    }
  };

  const isValidGitHubUrl = (url: string): boolean => {
    const githubPrRegex = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;
    return githubPrRegex.test(url);
  };

  const isUrlValid = inputValue ? isValidGitHubUrl(inputValue) : true;

  const handleTestConnection = async () => {
    if (!inputValue || !isValidGitHubUrl(inputValue)) return;
    setIsTesting(true);
    setTestTitle(null);
    setTestError(null);
    try {
      const pr = await githubService.parsePullRequest(inputValue.trim());
      setTestTitle(pr.title);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '接続テストに失敗しました';
      setTestError(msg);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          プルリクエストクイズ生成
        </CardTitle>
        <CardDescription>
          GitHub プルリクエストのURLを入力してクイズを生成します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className={!isUrlValid ? "border-destructive" : ""}
            />
            {!isUrlValid && (
              <p className="text-sm text-destructive">
                有効なGitHub プルリクエストのURLを入力してください
              </p>
            )}
            {/* 接続テスト行 */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isLoading || isTesting || !inputValue || !isUrlValid}
                className="flex-shrink-0"
              >
                接続をテスト
              </Button>
              {isTesting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />}
              {testTitle && !isTesting && (
                <div className="flex items-center gap-2 text-green-600 text-sm flex-1 min-w-0">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">タイトル: {testTitle}</span>
                </div>
              )}
              {testError && !isTesting && (
                <div className="flex items-center gap-2 text-destructive text-sm flex-1 min-w-0">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{testError}</span>
                </div>
              )}
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !inputValue.trim() || !isUrlValid}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                クイズ生成中...
              </>
            ) : (
              'クイズを生成'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
