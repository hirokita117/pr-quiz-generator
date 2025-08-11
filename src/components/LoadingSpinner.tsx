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
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-center">{message}</p>
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
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-primary/10 rounded-full"></div>
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
                      ? 'bg-primary/10 border-l-4 border-primary'
                      : isCompleted
                      ? 'bg-accent border-l-4 border-accent-foreground'
                      : 'bg-muted border-l-4 border-border'
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : isCompleted
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? 'text-foreground'
                        : isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.text}
                  </span>
                  {isActive && (
                    <div className="ml-auto">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 進行状況バー */}
          <div className="w-full max-w-md">
            <div className="bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              ></div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-2">
              ステップ {currentStep + 1} / {steps.length}
            </p>
          </div>

          {/* ヒントメッセージ */}
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">
              大きなプルリクエストの場合、数分かかることがあります
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
