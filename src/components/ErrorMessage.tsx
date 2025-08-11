import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Settings,
  Github,
  Key,
  Wifi,
  X
} from 'lucide-react';
import { useQuizStore } from '@/store/useQuizStore';

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  error, 
  onRetry, 
  onDismiss 
}) => {
  const { setError } = useQuizStore();

  const getErrorType = (errorMessage: string) => {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('api') && message.includes('key')) {
      return 'api_key';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('github') || message.includes('not found')) {
      return 'github';
    }
    if (message.includes('rate limit')) {
      return 'rate_limit';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    return 'general';
  };

  const getErrorConfig = (type: string) => {
    switch (type) {
      case 'api_key':
        return {
          icon: Key,
          title: 'APIキーエラー',
          color: 'red',
          suggestions: [
            'AIプロバイダーのAPIキーが正しく設定されているか確認してください',
            '設定パネルでAPIキーを再入力してください',
            'APIキーが有効で十分なクレジットがあるか確認してください'
          ],
          actionText: '設定を確認',
          actionIcon: Settings
        };
      
      case 'network':
        return {
          icon: Wifi,
          title: 'ネットワークエラー',
          color: 'orange',
          suggestions: [
            'インターネット接続を確認してください',
            'ファイアウォールやプロキシ設定を確認してください',
            '少し待ってから再試行してください'
          ],
          actionText: '再試行',
          actionIcon: RefreshCw
        };
      
      case 'github':
        return {
          icon: Github,
          title: 'GitHub APIエラー',
          color: 'blue',
          suggestions: [
            'プルリクエストのURLが正しいか確認してください',
            'プライベートリポジトリの場合、GitHubトークンが必要です',
            'プルリクエストが存在し、アクセス可能か確認してください'
          ],
          actionText: 'GitHubで確認',
          actionIcon: ExternalLink
        };
      
      case 'rate_limit':
        return {
          icon: AlertTriangle,
          title: 'レート制限エラー',
          color: 'yellow',
          suggestions: [
            'API使用量が制限に達しています',
            '少し時間をおいてから再試行してください',
            '有料プランへのアップグレードを検討してください'
          ],
          actionText: '後で再試行',
          actionIcon: RefreshCw
        };
      
      case 'timeout':
        return {
          icon: AlertTriangle,
          title: 'タイムアウトエラー',
          color: 'orange',
          suggestions: [
            '処理に時間がかかりすぎました',
            '大きなプルリクエストの場合、しばらく待ってから再試行してください',
            'ネットワーク接続が安定しているか確認してください'
          ],
          actionText: '再試行',
          actionIcon: RefreshCw
        };
      
      default:
        return {
          icon: AlertTriangle,
          title: 'エラーが発生しました',
          color: 'red',
          suggestions: [
            '予期しないエラーが発生しました',
            'しばらく待ってから再試行してください',
            '問題が続く場合は、開発者にお問い合わせください'
          ],
          actionText: '再試行',
          actionIcon: RefreshCw
        };
    }
  };

  const errorType = getErrorType(error);
  const config = getErrorConfig(errorType);
  const Icon = config.icon;
  const ActionIcon = config.actionIcon;

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      setError(null);
    }
  };

  const handleAction = () => {
    if (errorType === 'github') {
      // GitHubで確認する場合の処理
      window.open('https://github.com', '_blank');
    } else if (errorType === 'api_key') {
      // 設定パネルを開く処理（実装は省略）
      console.log('Open settings panel');
    } else if (onRetry) {
      onRetry();
    }
  };

  const colorMap = {
    red: {
      border: 'border-destructive',
      bg50: 'bg-destructive/5',
      bg100: 'bg-destructive/10',
      text500: 'text-destructive',
      text600: 'text-destructive',
      text700: 'text-destructive',
      text800: 'text-destructive',
      hoverText700: 'hover:text-destructive',
      bg600: 'bg-destructive',
      hoverBg700: 'hover:bg-destructive/90',
    },
    orange: {
      border: 'border-accent',
      bg50: 'bg-accent/10',
      bg100: 'bg-accent/20',
      text500: 'text-accent',
      text600: 'text-accent',
      text700: 'text-accent',
      text800: 'text-accent',
      hoverText700: 'hover:text-accent',
      bg600: 'bg-accent',
      hoverBg700: 'hover:bg-accent/90',
    },
    blue: {
      border: 'border-primary',
      bg50: 'bg-primary/5',
      bg100: 'bg-primary/10',
      text500: 'text-primary',
      text600: 'text-primary',
      text700: 'text-primary',
      text800: 'text-primary',
      hoverText700: 'hover:text-primary',
      bg600: 'bg-primary',
      hoverBg700: 'hover:bg-primary/90',
    },
    yellow: {
      // secondary はニュートラル傾向のため、アクセントにフォールバック
      border: 'border-accent',
      bg50: 'bg-accent/10',
      bg100: 'bg-accent/20',
      text500: 'text-accent',
      text600: 'text-accent',
      text700: 'text-accent',
      text800: 'text-accent',
      hoverText700: 'hover:text-accent',
      bg600: 'bg-accent',
      hoverBg700: 'hover:bg-accent/90',
    },
  } as const;

  const { color } = config;
  const colors = colorMap[color as keyof typeof colorMap] || colorMap.red;

  return (
    <Card className={`w-full ${colors.border} ${colors.bg50}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${colors.bg100}`}>
              <Icon className={`h-5 w-5 ${colors.text600}`} />
            </div>
            <div>
              <CardTitle className={`${colors.text800}`}>
                {config.title}
              </CardTitle>
              <CardDescription className={`${colors.text600} mt-1`}>
                {error}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className={`${colors.text500} ${colors.hoverText700}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* 解決策の提案 */}
          <div>
            <h4 className={`text-sm font-medium ${colors.text800} mb-2`}>
              解決方法:
            </h4>
            <ul className="space-y-1">
              {config.suggestions.map((suggestion, index) => (
                <li key={index} className={`text-sm ${colors.text700} flex items-start gap-2`}>
                  <span className="text-xs mt-1">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleAction}
              className={`${colors.bg600} ${colors.hoverBg700}`}
            >
              <ActionIcon className="mr-2 h-4 w-4" />
              {config.actionText}
            </Button>
            
            {onRetry && errorType !== 'api_key' && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                再試行
              </Button>
            )}
          </div>

          {/* 追加情報 */}
          <div className={`text-xs ${colors.text600} pt-2 border-t ${colors.border}`}>
            問題が解決しない場合は、ブラウザのコンソールでエラーの詳細を確認してください。
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
