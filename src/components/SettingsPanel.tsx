import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/store/useQuizStore';
import { Settings, Save, Eye, EyeOff } from 'lucide-react';
import type { AIProvider } from '@/types';

export const SettingsPanel: React.FC = () => {
  const { config, updateConfig } = useQuizStore();
  
  const [openaiKey, setOpenaiKey] = useState(config.apiKeys?.openai || '');
  const [googleKey, setGoogleKey] = useState(config.apiKeys?.google || '');
  const [localEndpoint, setLocalEndpoint] = useState(config.localLLM?.endpoint || 'http://localhost:11434');
  const [showKeys, setShowKeys] = useState(false);
  
  // 設定をローカルストレージから読み込み
  useEffect(() => {
    const savedOpenaiKey = localStorage.getItem('pr-quiz-openai-key') || '';
    const savedGoogleKey = localStorage.getItem('pr-quiz-google-key') || '';
    const savedLocalEndpoint = localStorage.getItem('pr-quiz-local-endpoint') || 'http://localhost:11434';
    
    setOpenaiKey(savedOpenaiKey);
    setGoogleKey(savedGoogleKey);
    setLocalEndpoint(savedLocalEndpoint);
    
    // ストアも更新
    updateConfig({
      apiKeys: {
        openai: savedOpenaiKey,
        google: savedGoogleKey,
      },
      localLLM: {
        endpoint: savedLocalEndpoint,
        model: 'llama2',
      },
    });
  }, [updateConfig]);

  const handleProviderChange = (provider: AIProvider) => {
    updateConfig({ aiProvider: provider });
  };

  const handleSaveSettings = () => {
    // ローカルストレージに保存
    localStorage.setItem('pr-quiz-openai-key', openaiKey);
    localStorage.setItem('pr-quiz-google-key', googleKey);
    localStorage.setItem('pr-quiz-local-endpoint', localEndpoint);
    
    // ストアを更新
    updateConfig({
      apiKeys: {
        openai: openaiKey,
        google: googleKey,
      },
      localLLM: {
        endpoint: localEndpoint,
        model: 'llama2',
      },
    });
    
    alert('設定が保存されました');
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <Card className="w-full h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          AI設定
        </CardTitle>
        <CardDescription>
          AIプロバイダーとAPIキーを設定してください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AIプロバイダー選択 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">AIプロバイダー</label>
          <Select 
            value={config.aiProvider} 
            onValueChange={handleProviderChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="プロバイダーを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
              <SelectItem value="google">Google (Gemini)</SelectItem>
              <SelectItem value="local">ローカルLLM (Ollama)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* OpenAI APIキー */}
        {(config.aiProvider === 'openai' || config.aiProvider === 'google') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">APIキー</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeys(!showKeys)}
              >
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            {config.aiProvider === 'openai' && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">OpenAI API Key</label>
                <Input
                  type={showKeys ? "text" : "password"}
                  placeholder="sk-..."
                  value={showKeys ? openaiKey : maskKey(openaiKey)}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
            )}
            
            {config.aiProvider === 'google' && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Google API Key</label>
                <Input
                  type={showKeys ? "text" : "password"}
                  placeholder="AIza..."
                  value={showKeys ? googleKey : maskKey(googleKey)}
                  onChange={(e) => setGoogleKey(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* ローカルLLM設定 */}
        {config.aiProvider === 'local' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Ollama エンドポイント</label>
            <Input
              type="url"
              placeholder="http://localhost:11434"
              value={localEndpoint}
              onChange={(e) => setLocalEndpoint(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ollamaサーバーのエンドポイントを指定してください
            </p>
          </div>
        )}

        {/* クイズ設定 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">クイズ設定</h4>
          
          <div className="space-y-2">
            <label className="text-sm">質問数</label>
            <Select 
              value={config.questionCount?.toString() || '10'} 
              onValueChange={(value) => updateConfig({ questionCount: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5問</SelectItem>
                <SelectItem value="10">10問</SelectItem>
                <SelectItem value="15">15問</SelectItem>
                <SelectItem value="20">20問</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm">難易度</label>
            <Select 
              value={config.difficulty || 'mixed'} 
              onValueChange={(value) => updateConfig({ difficulty: value as 'easy' | 'medium' | 'hard' | 'mixed' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">簡単</SelectItem>
                <SelectItem value="medium">普通</SelectItem>
                <SelectItem value="hard">難しい</SelectItem>
                <SelectItem value="mixed">混合</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 保存ボタン */}
        <Button onClick={handleSaveSettings} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          設定を保存
        </Button>
      </CardContent>
    </Card>
  );
};
