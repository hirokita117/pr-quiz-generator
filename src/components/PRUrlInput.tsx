import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuizStore } from '@/store/useQuizStore';
import { Loader2, Github } from 'lucide-react';

export const PRUrlInput: React.FC = () => {
  const { 
    pullRequestUrl, 
    isLoading, 
    setPullRequestUrl, 
    generateQuiz 
  } = useQuizStore();
  
  const [inputValue, setInputValue] = useState(pullRequestUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setPullRequestUrl(inputValue.trim());
      await generateQuiz(inputValue.trim());
    }
  };

  const isValidGitHubUrl = (url: string): boolean => {
    const githubPrRegex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+$/;
    return githubPrRegex.test(url);
  };

  const isUrlValid = inputValue ? isValidGitHubUrl(inputValue) : true;

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
              className={!isUrlValid ? "border-red-500" : ""}
            />
            {!isUrlValid && (
              <p className="text-sm text-red-500">
                有効なGitHub プルリクエストのURLを入力してください
              </p>
            )}
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
