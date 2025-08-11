import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/store/useQuizStore';
import { 
  Trophy, 
  Clock, 
  Brain, 
  CheckCircle, 
  XCircle, 
  Code2, 
  FileText,
  Download,
  Share2
} from 'lucide-react';
import type { Question } from '@/types';

export const QuizDisplay: React.FC = () => {
  const { currentQuiz } = useQuizStore();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState(false);

  if (!currentQuiz) {
    return null;
  }

  const handleAnswerSelect = (questionId: string, answer: string, isMultipleChoice: boolean = false) => {
    setSelectedAnswers(prev => {
      const currentAnswers = prev[questionId] || [];
      
      if (isMultipleChoice) {
        // 複数選択肢の場合：選択済みなら削除、未選択なら追加
        if (currentAnswers.includes(answer)) {
          return {
            ...prev,
            [questionId]: currentAnswers.filter(a => a !== answer)
          };
        } else {
          return {
            ...prev,
            [questionId]: [...currentAnswers, answer]
          };
        }
      } else {
        // 単一選択肢の場合：置き換え
        return {
          ...prev,
          [questionId]: [answer]
        };
      }
    });
  };

  const calculateScore = () => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    currentQuiz.questions.forEach(question => {
      const userAnswers = selectedAnswers[question.id] || [];
      
      if (Array.isArray(question.correctAnswer)) {
        // 複数正解がある問題の場合
        const correctAnswers = question.correctAnswer;
        const userCorrectAnswers = userAnswers.filter(answer => correctAnswers.includes(answer));
        const userIncorrectAnswers = userAnswers.filter(answer => !correctAnswers.includes(answer));
        
        // 部分点計算：正解数 - 不正解数（負の点数は0点）
        const questionScore = Math.max(0, userCorrectAnswers.length - userIncorrectAnswers.length);
        totalScore += questionScore;
        maxPossibleScore += correctAnswers.length;
      } else {
        // 単一正解の問題の場合
        if (userAnswers.length === 1 && userAnswers[0] === question.correctAnswer) {
          totalScore += 1;
        }
        maxPossibleScore += 1;
      }
    });
    
    return { score: totalScore, maxScore: maxPossibleScore };
  };

  const { score, maxScore } = calculateScore();
  const totalQuestions = currentQuiz.questions.length;
  const scorePercentage = Math.round((score / maxScore) * 100);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-foreground bg-muted';
      case 'medium': return 'text-foreground bg-muted';
      case 'hard': return 'text-foreground bg-muted';
      default: return 'text-foreground bg-muted';
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'code-review': return <Code2 className="h-4 w-4" />;
      case 'explanation': return <FileText className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const renderQuestion = (question: Question) => {
    const userAnswers = selectedAnswers[question.id] || [];
    const isCorrect = Array.isArray(question.correctAnswer) 
      ? userAnswers.every(answer => question.correctAnswer.includes(answer))
      : userAnswers.length === 1 && userAnswers[0] === question.correctAnswer;

    return (
      <AccordionItem key={question.id} value={question.id}>
        <AccordionTrigger className="text-left">
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-2">
              {getQuestionTypeIcon(question.type)}
              <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                {question.difficulty}
              </span>
            </div>
            <span className="flex-1 text-sm">{question.content}</span>
            {showResults && (
              <div className="flex-shrink-0">
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            {/* コードスニペット */}
            {question.code && (
              <div className="bg-muted p-4 rounded-lg border border-border">
                <pre className="text-sm overflow-x-auto">
                  <code>{question.code.content}</code>
                </pre>
                {question.code.language && (
                  <p className="text-xs text-muted-foreground mt-2">言語: {question.code.language}</p>
                )}
              </div>
            )}

            {/* 選択肢 */}
            {question.options && (
              <div className="space-y-2">
                <p className="font-medium text-sm">選択肢:</p>
                {question.options.map((option, index) => {
                  const isMultipleChoice = Array.isArray(question.correctAnswer);
                  const isCorrectAnswer = isMultipleChoice 
                    ? question.correctAnswer.includes(option.id)
                    : question.correctAnswer === option.id;
                  const isUserSelected = userAnswers.includes(option.id);
                  
                  return (
                    <label
                      key={index}
                      className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors
                        ${isUserSelected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}
                        ${showResults && isCorrectAnswer ? 'border-primary bg-primary/10' : ''}
                        ${showResults && isUserSelected && !isCorrectAnswer ? 'border-destructive bg-destructive/10' : ''}
                      `}
                    >
                      <input
                        type={isMultipleChoice ? "checkbox" : "radio"}
                        name={question.id}
                        value={option.id}
                        checked={isUserSelected}
                        onChange={() => handleAnswerSelect(question.id, option.id, isMultipleChoice)}
                        disabled={showResults}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 border-2 rounded-full ${isUserSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                        {isUserSelected && <div className="w-full h-full bg-background rounded-full scale-50"></div>}
                      </div>
                      <span className="text-sm">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* 解説（結果表示時のみ） */}
            {showResults && (
              <div className="mt-4 p-4 bg-muted border border-border rounded-lg">
                <h5 className="font-medium text-foreground mb-2">解説:</h5>
                <p className="text-sm text-muted-foreground">{question.explanation}</p>
                
                {/* 部分点の詳細表示 */}
                {Array.isArray(question.correctAnswer) && (
                  <div className="mt-3 p-3 bg-card border border-border rounded">
                    <h6 className="font-medium text-foreground mb-2 text-sm">部分点の計算:</h6>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>正解選択: {userAnswers.filter(a => question.correctAnswer.includes(a)).length} / {question.correctAnswer.length}</div>
                      <div>不正解選択: {userAnswers.filter(a => !question.correctAnswer.includes(a)).length}</div>
                      <div>最終スコア: {Math.max(0, userAnswers.filter(a => question.correctAnswer.includes(a)).length - userAnswers.filter(a => !question.correctAnswer.includes(a)).length)} / {question.correctAnswer.length}</div>
                    </div>
                  </div>
                )}
                
                {question.tags && question.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {question.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="space-y-6">
      {/* クイズヘッダー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            生成されたクイズ
          </CardTitle>
          <CardDescription>
            プルリクエスト: {currentQuiz.pullRequestUrl}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              {totalQuestions}問
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {currentQuiz.metadata.aiProvider}
            </div>
            {currentQuiz.metadata.processingTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                処理時間: {Math.round(currentQuiz.metadata.processingTime / 1000)}秒
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* スコア表示（結果表示時） */}
      {showResults && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">
                {score} / {maxScore}
              </div>
              <div className="text-lg text-muted-foreground">
                正答率: {scorePercentage}%
              </div>
              <div className="text-sm text-muted-foreground">
                {scorePercentage >= 80 ? '素晴らしい!' : 
                 scorePercentage >= 60 ? 'よくできました!' : 
                 '復習が必要かもしれません'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 質問一覧 */}
      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {currentQuiz.questions.map(renderQuestion)}
          </Accordion>
        </CardContent>
      </Card>

      {/* アクションボタン */}
      <div className="flex gap-3">
        {!showResults ? (
          <Button 
            onClick={() => setShowResults(true)}
            disabled={Object.keys(selectedAnswers).length < totalQuestions}
            className="flex-1"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            結果を確認
          </Button>
        ) : (
          <>
            <Button 
              onClick={() => {
                setShowResults(false);
                setSelectedAnswers({});
              }}
              variant="outline"
              className="flex-1"
            >
              もう一度挑戦
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
            <Button variant="outline">
              <Share2 className="mr-2 h-4 w-4" />
              共有
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
