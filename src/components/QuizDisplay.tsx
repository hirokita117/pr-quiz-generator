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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (!currentQuiz) {
    return null;
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    currentQuiz.questions.forEach(question => {
      const userAnswer = selectedAnswers[question.id];
      if (Array.isArray(question.correctAnswer)) {
        if (question.correctAnswer.includes(userAnswer)) {
          correct++;
        }
      } else {
        if (userAnswer === question.correctAnswer) {
          correct++;
        }
      }
    });
    return correct;
  };

  const score = calculateScore();
  const totalQuestions = currentQuiz.questions.length;
  const scorePercentage = Math.round((score / totalQuestions) * 100);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
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
    const userAnswer = selectedAnswers[question.id];
    const isCorrect = Array.isArray(question.correctAnswer) 
      ? question.correctAnswer.includes(userAnswer)
      : userAnswer === question.correctAnswer;

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
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            {/* コードスニペット */}
            {question.code && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <pre className="text-sm overflow-x-auto">
                  <code>{question.code.content}</code>
                </pre>
                {question.code.language && (
                  <p className="text-xs text-gray-500 mt-2">言語: {question.code.language}</p>
                )}
              </div>
            )}

            {/* 選択肢 */}
            {question.options && (
              <div className="space-y-2">
                <p className="font-medium text-sm">選択肢:</p>
                {question.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors
                      ${userAnswer === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
                      ${showResults && option.value === question.correctAnswer ? 'border-green-500 bg-green-50' : ''}
                      ${showResults && userAnswer === option.value && userAnswer !== question.correctAnswer ? 'border-red-500 bg-red-50' : ''}
                    `}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      checked={userAnswer === option.value}
                      onChange={(e) => handleAnswerSelect(question.id, e.target.value)}
                      disabled={showResults}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 border-2 rounded-full ${userAnswer === option.value ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {userAnswer === option.value && <div className="w-full h-full bg-white rounded-full scale-50"></div>}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* 解説（結果表示時のみ） */}
            {showResults && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">解説:</h5>
                <p className="text-sm text-blue-800">{question.explanation}</p>
                {question.tags && question.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {question.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded">
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
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
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
              <div className="text-3xl font-bold text-blue-600">
                {score} / {totalQuestions}
              </div>
              <div className="text-lg text-gray-600">
                正答率: {scorePercentage}%
              </div>
              <div className="text-sm text-gray-500">
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
