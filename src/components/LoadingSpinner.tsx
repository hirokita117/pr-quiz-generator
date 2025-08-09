import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Brain, Github, Zap } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  detailed?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'クイズを生成中...', 
  detailed = false 
}) => {
  const steps = [
    { icon: Github, text: 'プルリクエストを取得中...', duration: 2000 },
    { icon: Brain, text: 'コードを解析中...', duration: 3000 },
    { icon: Zap, text: 'AIがクイズを生成中...', duration: 5000 },
  ];

  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    if (!detailed) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [detailed, steps.length]);

  if (!detailed) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-600 text-center">{message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="py-12">
        <div className="flex flex-col items-center space-y-8">
          {/* メインスピナー */}
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full"></div>
            </div>
          </div>

          {/* ステップ表示 */}
          <div className="w-full max-w-md space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                    isActive
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : isCompleted
                      ? 'bg-green-50 border-l-4 border-green-500'
                      : 'bg-gray-50 border-l-4 border-gray-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      isActive
                        ? 'bg-blue-100 text-blue-600'
                        : isCompleted
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? 'text-blue-700'
                        : isCompleted
                        ? 'text-green-700'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.text}
                  </span>
                  {isActive && (
                    <div className="ml-auto">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 進行状況バー */}
          <div className="w-full max-w-md">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              ></div>
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
              ステップ {currentStep + 1} / {steps.length}
            </p>
          </div>

          {/* ヒントメッセージ */}
          <div className="text-center space-y-2">
            <p className="text-gray-600">{message}</p>
            <p className="text-xs text-gray-500">
              大きなプルリクエストの場合、数分かかることがあります
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
