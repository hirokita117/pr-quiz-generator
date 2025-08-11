import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/store/useQuizStore';
import { Settings, Save, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { AIProvider, QuizConfig } from '@/types';
import { AIServiceFactory } from '@/services/ai';

export const SettingsPanel: React.FC = () => {
  const { config, updateConfig } = useQuizStore();
  
  const [openaiKey, setOpenaiKey] = useState(config.apiKeys?.openai || '');
  const [googleKey, setGoogleKey] = useState(config.apiKeys?.google || '');
  const [googleModel, setGoogleModel] = useState(config.googleModel || 'gemini-pro');
  const [localEndpoint, setLocalEndpoint] = useState(config.localLLM?.endpoint || 'http://localhost:11434');
  const [localModel, setLocalModel] = useState(config.localLLM?.model || 'llama2');
  const [showKeys, setShowKeys] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<null | 'success' | 'error'>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  
  // 設定をローカルストレージから読み込み
  useEffect(() => {
    const savedOpenaiKey = localStorage.getItem('pr-quiz-openai-key') || '';
    const savedGoogleKey = localStorage.getItem('pr-quiz-google-key') || '';
    const savedGoogleModel = localStorage.getItem('pr-quiz-google-model') || 'gemini-pro';
    const savedLocalEndpoint = localStorage.getItem('pr-quiz-local-endpoint') || 'http://localhost:11434';
    const savedLocalModel = localStorage.getItem('pr-quiz-local-model') || 'llama2';
    
    setOpenaiKey(savedOpenaiKey);
    setGoogleKey(savedGoogleKey);
    setGoogleModel(savedGoogleModel);
    setLocalEndpoint(savedLocalEndpoint);
    setLocalModel(savedLocalModel);
    
    // ストアも更新
    updateConfig({
      apiKeys: {
        openai: savedOpenaiKey,
        google: savedGoogleKey,
      },
      googleModel: savedGoogleModel,
      localLLM: {
        endpoint: savedLocalEndpoint,
        model: savedLocalModel,
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
    localStorage.setItem('pr-quiz-google-model', googleModel);
    localStorage.setItem('pr-quiz-local-endpoint', localEndpoint);
    localStorage.setItem('pr-quiz-local-model', localModel);
    
    // ストアを更新
    updateConfig({
      apiKeys: {
        openai: openaiKey,
        google: googleKey,
      },
      googleModel,
      localLLM: {
        endpoint: localEndpoint,
        model: localModel,
      },
    });
    
    alert('設定が保存されました');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    setTestMessage(null);

    try {
      // 入力中の値を優先して、一時的な設定を組み立て
      const testConfig: QuizConfig = {
        ...config,
        aiProvider: config.aiProvider,
        apiKeys: {
          openai: openaiKey,
          google: googleKey,
        },
        localLLM: config.aiProvider === 'local'
          ? {
              endpoint: localEndpoint,
              model: localModel || config.localLLM?.model || 'llama2',
              apiKey: config.localLLM?.apiKey,
            }
          : config.localLLM,
      };

      const service = AIServiceFactory.create({
        ...testConfig,
        googleModel: googleModel || config.googleModel || 'gemini-pro',
      });
      const ok = await service.validateConnection();
      if (ok) {
        setTestStatus('success');
        setTestMessage('認証と接続に成功しました。');
      } else {
        setTestStatus('error');
        setTestMessage('接続に失敗しました。APIキーやエンドポイント設定を確認してください。');
      }
    } catch (e) {
      setTestStatus('error');
      const message = e instanceof Error ? e.message : '不明なエラーが発生しました';
      setTestMessage(message);
    } finally {
      setIsTesting(false);
    }
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

        {/* OpenAI / Google APIキー */}
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
                  value={openaiKey}
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
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                />
                <div className="space-y-2 pt-2">
                  <label className="text-xs text-muted-foreground">Gemini モデル</label>
                  <Select
                    value={googleModel}
                    onValueChange={(value) => {
                      setGoogleModel(value);
                      updateConfig({ googleModel: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</SelectItem>
                      <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                      <SelectItem value="gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">使用する Gemini モデルを選択してください。</p>
                </div>
              </div>
            )}

            {/* 接続テスト */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                接続をテスト
              </Button>
              {isTesting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {testStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>✅ 接続成功</span>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-center gap-1 text-destructive text-sm">
                  <XCircle className="h-4 w-4" />
                  <span>❌ 接続に失敗</span>
                </div>
              )}
            </div>
            {testMessage && (
              <p className="text-xs text-muted-foreground">{testMessage}</p>
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
              onChange={(e) => {
                const v = e.target.value;
                setLocalEndpoint(v);
                updateConfig({ localLLM: { endpoint: v, model: localModel } });
              }}
            />
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">モデル名</label>
              <Input
                type="text"
                placeholder="gpt-oss:20b など"
                value={localModel}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalModel(v);
                  updateConfig({ localLLM: { endpoint: localEndpoint, model: v } });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Ollama にインストール済みのモデル名を指定してください（例: gpt-oss:20b）。
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ollamaサーバーのエンドポイントを指定してください
            </p>

            {/* 接続テスト（ローカル） */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                接続をテスト
              </Button>
              {isTesting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {testStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>✅ 接続成功</span>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-center gap-1 text-destructive text-sm">
                  <XCircle className="h-4 w-4" />
                  <span>❌ 接続に失敗</span>
                </div>
              )}
            </div>
            {testMessage && (
              <p className="text-xs text-muted-foreground">{testMessage}</p>
            )}
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
