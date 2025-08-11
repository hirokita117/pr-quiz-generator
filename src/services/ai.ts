import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Question, PullRequest, PRFile, QuizConfig, FocusArea, LocalLLMConfig } from '@/types';
import { env } from '@/utils/env';

// クイズ生成のコンテキスト
export interface QuizContext {
  pullRequest: PullRequest;
  changes: CodeChange[];
  complexity: number;
  languages: string[];
  patterns: string[];
  focusAreas: FocusArea[];
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
}

// コード変更の分析結果
interface CodeChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  filename: string;
  language: string;
  linesChanged: number;
  complexity: number;
  summary: string;
}

// AIレスポンスの生問題データ構造
interface RawQuestionResponse {
  id?: string;
  type?: 'multiple-choice' | 'true-false' | 'code-review' | 'explanation';
  content: string;
  code?: {
    language?: string;
    content: string;
    filename?: string;
  };
  options?: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  correctAnswer: string | string[];
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

// AI サービスエラー
export class AIServiceError extends Error {
  public provider: string;
  public details?: unknown;
  
  constructor(
    message: string,
    provider: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.provider = provider;
    this.details = details;
  }
}

// AI サービスの抽象基底クラス
export abstract class AIService {
  abstract generateQuestions(context: QuizContext): Promise<Question[]>;
  abstract validateConnection(): Promise<boolean>;
  abstract getName(): string;
}

// OpenAI サービス実装
// 安全にネストしたプロパティから文字列を取得するユーティリティ
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractStringPath(data: unknown, path: string[]): string | undefined {
  let current: unknown = data;
  for (const segment of path) {
    if (isRecord(current) && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

// パッチテキスト内の機密情報をマスキング
function sanitizePatch(patch: string): string {
  if (!patch) return patch;

  let result = patch;

  const replacements: Array<[RegExp, string]> = [
    // PEM/SSH 秘密鍵ブロック
    [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, '$1\n[REDACTED]\n$2'],
    [/(-----BEGIN OPENSSH PRIVATE KEY-----)[\s\S]*?(-----END OPENSSH PRIVATE KEY-----)/g, '$1\n[REDACTED]\n$2'],

    // Authorization や API キー系ヘッダー
    [/((?:Authorization|authorization)\s*:\s*Bearer\s+)[^\s]+/g, '$1[REDACTED]'],
    [/((?:X-|x-)?Api[-_]?Key\s*:\s*)[^\s]+/g, '$1[REDACTED]'],

    // JWT トークン
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]'],

    // 各種既知のトークン形式
    [/\bgh[oprsu]_[A-Za-z0-9]{36,255}\b/g, '[REDACTED_GITHUB_TOKEN]'],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,48}\b/g, '[REDACTED_SLACK_TOKEN]'],
    [/\bAIza[0-9A-Za-z\-_]{35}\b/g, '[REDACTED_GOOGLE_API_KEY]'],
    [/\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g, '[REDACTED_STRIPE_SECRET_KEY]'],

    // AWS 資格情報
    [/\b(?:AKIA|ASIA|AGPA|AIDA|ANPA|AROA|A3T)[A-Z0-9]{16}\b/g, '[REDACTED_AWS_ACCESS_KEY_ID]'],
    [/(\baws[_-]?secret[_-]?access[_-]?key\b\s*[:=]\s*)(['"]?)[^'"\s]+(\2)/gi, '$1$2[REDACTED]$2'],
    [/(\baws[_-]?access[_-]?key[_-]?id\b\s*[:=]\s*)(['"]?)[^'"\s]+(\2)/gi, '$1$2[REDACTED]$2'],

    // 一般的な機密キー名の KV 形式
    [/(\b[A-Za-z0-9_.-]*?(?:secret|token|password|passwd|pwd|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret)[A-Za-z0-9_.-]*\b\s*[:=]\s*)(['"]?)[^'"\s]+(\2)/gi, '$1$2[REDACTED]$2'],

    // JSON/YAML 風の "key": "value"
    [/("?[A-Za-z0-9_.-]*?(?:secret|token|password|passwd|pwd|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret)"?\s*:\s*)(["'])([\s\S]*?)(\2)/gi, '$1$2[REDACTED]$2'],

    // 長い Base64 っぽい文字列や HEX 文字列
    [/\b[A-Za-z0-9+/]{30,}={0,2}\b/g, '[REDACTED_B64]'],
    [/\b[0-9a-fA-F]{32,}\b/g, '[REDACTED_HEX]'],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

export class OpenAIService extends AIService {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    super();
    this.client = axios.create({
      baseURL: env.openai.apiUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
  }

  getName(): string {
    return 'OpenAI';
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch (error) {
      console.debug(`${this.getName()} connection validation failed:`, error);
      return false;
    }
  }

  async generateQuestions(context: QuizContext): Promise<Question[]> {
    const prompt = this.buildPrompt(context);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response?.data?.choices?.[0]?.message?.content ?? '';
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AIServiceError('OpenAI API returned empty content', 'openai', response?.data);
      }
      return this.parseResponse(content, context.questionCount);
    } catch (unknownError) {
      const isAxiosErr = axios.isAxiosError(unknownError);
      const details = isAxiosErr ? unknownError.response?.data : undefined;
      const messageFromData = isAxiosErr ? extractStringPath(details, ['error', 'message']) : undefined;
      const message = messageFromData
        || (unknownError instanceof Error ? unknownError.message : undefined)
        || 'Unknown error';
      throw new AIServiceError(`OpenAI API error: ${message}`, 'openai', details);
    }
  }

  private getSystemPrompt(): string {
    return `あなたはソフトウェア開発の専門家で、GitHubのプルリクエストを分析してプログラミング学習用のクイズを作成するタスクを行います。

以下のルールに従ってクイズを作成してください：

1. 提供されたプルリクエストの内容を分析し、理解度を測るクイズを生成する
2. クイズの種類は以下から選択：
   - multiple-choice: 複数選択問題
   - true-false: 正誤問題
   - code-review: コードレビュー問題
   - explanation: 説明問題

3. 各問題には以下を含める：
   - 明確で理解しやすい問題文
   - 適切な選択肢（multiple-choiceの場合）
   - 正解
   - 詳細な説明

4. 回答は必ずJSON形式で以下の構造に従う：
{
  "questions": [
    {
      "id": "string",
      "type": "multiple-choice|true-false|code-review|explanation",
      "content": "問題文",
      "code": {
        "language": "言語名",
        "content": "コード内容",
        "filename": "ファイル名（オプション）"
      },
      "options": [
        {
          "id": "string",
          "text": "選択肢のテキスト",
          "isCorrect": boolean
        }
      ],
      "correctAnswer": "正解または正解の配列",
      "explanation": "詳細な説明",
      "difficulty": "easy|medium|hard",
      "tags": ["タグ配列"]
    }
  ]
}

5. コードの変更内容に基づいて、実際のプログラミングスキルを測定できる問題を作成する
6. 日本語で問題を作成する`;
  }

  private buildPrompt(context: QuizContext): string {
    const { pullRequest, changes, focusAreas, questionCount, difficulty } = context;

    const focusAreaText = focusAreas.map(area => `${area.type} (重要度: ${area.weight})`).join(', ');
    
    const changesText = changes.map(change => 
      `- ${change.filename} (${change.language}): ${change.type}, ${change.linesChanged}行変更, 複雑度: ${change.complexity}`
    ).join('\n');

    const filesText = pullRequest.files.slice(0, 5).map(file => {
      const rawPatchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
      const patchPreview = sanitizePatch(rawPatchPreview);
      return `## ${file.filename} (${file.language || 'unknown'})\n状態: ${file.status}\n追加: ${file.additions}行, 削除: ${file.deletions}行\n\n変更内容:\n\`\`\`\n${patchPreview}\n\`\`\``;
    }).join('\n\n');

    return `# プルリクエスト分析とクイズ生成

## プルリクエスト情報
- タイトル: ${pullRequest.title}
- 作成者: ${pullRequest.author}
- 説明: ${pullRequest.description}
- ファイル数: ${pullRequest.files.length}
- コミット数: ${pullRequest.commits.length}

## 変更の分析
${changesText}

## 主要な変更ファイル
${filesText}

## 要求事項
- 問題数: ${questionCount}
- 難易度: ${difficulty}
- 重点領域: ${focusAreaText}

上記のプルリクエストの内容を分析して、指定された数のクイズを生成してください。各問題は変更内容に関連し、プログラミングスキルの理解度を測定できるものにしてください。`;
  }

  private parseResponse(content: string, questionCount: number): Question[] {
    try {
      const parsed = JSON.parse(content);
      const questions = parsed.questions || [];

      return questions.slice(0, questionCount).map((q: RawQuestionResponse, index: number) => ({
        id: q.id || `question-${index + 1}`,
        type: q.type || 'multiple-choice',
        content: q.content,
        code: q.code || undefined,
        options: q.options || undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
      }));
    } catch (error) {
      throw new AIServiceError('Failed to parse AI response', 'openai', { content, error });
    }
  }
}

// Google AI サービス実装
export class GoogleAIService extends AIService {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    super();
    this.client = axios.create({
      baseURL: env.google.apiUrl,
      params: {
        key: apiKey,
      },
      timeout: 60000,
    });
  }

  getName(): string {
    return 'Google AI';
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch {
      return false;
    }
  }

  async generateQuestions(context: QuizContext): Promise<Question[]> {
    const prompt = this.buildPrompt(context);
    
    try {
      const response = await this.client.post('/models/gemini-pro:generateContent', {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      });

      const content = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AIServiceError('Google AI returned empty content', 'google', response?.data);
      }
      return this.parseResponse(content, context.questionCount);
    } catch (unknownError) {
      const isAxiosErr = axios.isAxiosError(unknownError);
      const details = isAxiosErr ? unknownError.response?.data : undefined;
      const messageFromData = isAxiosErr ? extractStringPath(details, ['error', 'message']) : undefined;
      const message = messageFromData
        || (unknownError instanceof Error ? unknownError.message : undefined)
        || 'Unknown error';
      throw new AIServiceError(`Google AI API error: ${message}`, 'google', details);
    }
  }

  private buildPrompt(context: QuizContext): string {
    const { pullRequest, changes, focusAreas, questionCount, difficulty } = context;

    const focusAreaText = focusAreas.map(area => `${area.type} (重要度: ${area.weight})`).join(', ');
    
    const changesText = changes.map(change => 
      `- ${change.filename} (${change.language}): ${change.type}, ${change.linesChanged}行変更, 複雑度: ${change.complexity}`
    ).join('\n');

    const filesText = pullRequest.files.slice(0, 5).map(file => {
      const rawPatchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
      const patchPreview = sanitizePatch(rawPatchPreview);
      return `## ${file.filename} (${file.language || 'unknown'})\n状態: ${file.status}\n追加: ${file.additions}行, 削除: ${file.deletions}行\n\n変更内容:\n\`\`\`\n${patchPreview}\n\`\`\``;
    }).join('\n\n');

    return `# プルリクエスト分析とクイズ生成

## プルリクエスト情報
- タイトル: ${pullRequest.title}
- 作成者: ${pullRequest.author}
- 説明: ${pullRequest.description}
- ファイル数: ${pullRequest.files.length}
- コミット数: ${pullRequest.commits.length}

## 変更の分析
${changesText}

## 主要な変更ファイル
${filesText}

## 要求事項
- 問題数: ${questionCount}
- 難易度: ${difficulty}
- 重点領域: ${focusAreaText}

上記のプルリクエストの内容を分析して、指定された数のクイズを生成してください。各問題は変更内容に関連し、プログラミングスキルの理解度を測定できるものにしてください。`;
  }

  private parseResponse(content: string, questionCount: number): Question[] {
    // JSONレスポンスを抽出
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : content;

    try {
      const parsed = JSON.parse(jsonContent);
      const questions = parsed.questions || [];

      return questions.slice(0, questionCount).map((q: RawQuestionResponse, index: number) => ({
        id: q.id || `question-${index + 1}`,
        type: q.type || 'multiple-choice',
        content: q.content,
        code: q.code || undefined,
        options: q.options || undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
      }));
    } catch (error) {
      throw new AIServiceError('Failed to parse Google AI response', 'google', { content, error });
    }
  }
}

// ローカル LLM サービス実装
export class LocalLLMService extends AIService {
  private client: AxiosInstance;
  private config: LocalLLMConfig;

  constructor(config: LocalLLMConfig) {
    super();
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
      timeout: 120000, // ローカルLLMは時間がかかる可能性があるため長めに設定
    });
  }

  getName(): string {
    return `Local LLM (${this.config.model})`;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const res = await this.client.get('/api/tags');
      const models = Array.isArray(res?.data?.models) ? res.data.models : [];
      const names = models.map((m: any) => m?.name).filter((n: any) => typeof n === 'string');
      if (this.config.model && !names.includes(this.config.model)) {
        throw new AIServiceError(`モデルが見つかりません: ${this.config.model}. インストール済み: ${names.join(', ') || 'なし'}`, 'local');
      }
      return true;
    } catch (e) {
      if (e instanceof AIServiceError) {
        throw e;
      }
      return false;
    }
  }

  async generateQuestions(context: QuizContext): Promise<Question[]> {
    const prompt = this.buildPrompt(context);
    
    try {
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      });

      console.log(response);

      const content = response?.data?.response ?? '';
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AIServiceError('Local LLM returned empty content', 'local', response?.data);
      }
      return this.parseResponse(content, context.questionCount);
    } catch (unknownError) {
      const isAxiosErr = axios.isAxiosError(unknownError);
      const details = isAxiosErr ? unknownError.response?.data : undefined;
      const messageFromData = isAxiosErr ? extractStringPath(details, ['error']) : undefined;
      const message = messageFromData
        || (unknownError instanceof Error ? unknownError.message : undefined)
        || 'Unknown error';
      throw new AIServiceError(`Local LLM error: ${message}`, 'local', details);
    }
  }

  private buildPrompt(context: QuizContext): string {
    const { pullRequest, changes, focusAreas, questionCount, difficulty } = context;

    const focusAreaText = focusAreas.map(area => `${area.type} (重要度: ${area.weight})`).join(', ');
    
    const changesText = changes.map(change => 
      `- ${change.filename} (${change.language}): ${change.type}, ${change.linesChanged}行変更, 複雑度: ${change.complexity}`
    ).join('\n');

    const filesText = pullRequest.files.slice(0, 5).map(file => {
      const rawPatchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
      const patchPreview = sanitizePatch(rawPatchPreview);
      return `## ${file.filename} (${file.language || 'unknown'})\n状態: ${file.status}\n追加: ${file.additions}行, 削除: ${file.deletions}行\n\n変更内容:\n\`\`\`\n${patchPreview}\n\`\`\``;
    }).join('\n\n');

    return `# プルリクエスト分析とクイズ生成

## プルリクエスト情報
- タイトル: ${pullRequest.title}
- 作成者: ${pullRequest.author}
- 説明: ${pullRequest.description}
- ファイル数: ${pullRequest.files.length}
- コミット数: ${pullRequest.commits.length}

## 変更の分析
${changesText}

## 主要な変更ファイル
${filesText}

## 要求事項
- 問題数: ${questionCount}
- 難易度: ${difficulty}
- 重点領域: ${focusAreaText}

上記のプルリクエストの内容を分析して、指定された数のクイズを生成してください。各問題は変更内容に関連し、プログラミングスキルの理解度を測定できるものにしてください。`;
  }

  private parseResponse(content: string, questionCount: number): Question[] {
    try {
      const parsed = JSON.parse(content);
      const questions = parsed.questions || [];

      return questions.slice(0, questionCount).map((q: RawQuestionResponse, index: number) => ({
        id: q.id || `question-${index + 1}`,
        type: q.type || 'multiple-choice',
        content: q.content,
        code: q.code || undefined,
        options: q.options || undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        tags: q.tags || [],
      }));
    } catch (error) {
      throw new AIServiceError('Failed to parse Local LLM response', 'local', { content, error });
    }
  }
}

// AI サービスファクトリー
export class AIServiceFactory {
  static create(config: QuizConfig): AIService {
    switch (config.aiProvider) {
      case 'openai':
        if (!config.apiKeys?.openai) {
          throw new AIServiceError('OpenAI API key is required', 'openai');
        }
        return new OpenAIService(config.apiKeys.openai);

      case 'google':
        if (!config.apiKeys?.google) {
          throw new AIServiceError('Google API key is required', 'google');
        }
        return new GoogleAIService(config.apiKeys.google);

      case 'local':
        if (!config.localLLM) {
          throw new AIServiceError('Local LLM configuration is required', 'local');
        }
        return new LocalLLMService(config.localLLM);

      default:
        throw new AIServiceError(`Unsupported AI provider: ${config.aiProvider}`, 'unknown');
    }
  }
}

// クイズ生成器
export class QuizGenerator {
  private aiService: AIService;

  constructor(config: QuizConfig) {
    this.aiService = AIServiceFactory.create(config);
  }

  /**
   * PR情報からクイズ生成コンテキストを構築
   */
  buildContext(
    pullRequest: PullRequest,
    options: {
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      focusAreas?: FocusArea[];
    } = {}
  ): QuizContext {
    const changes = this.analyzeChanges(pullRequest.files);
    const complexity = this.calculateComplexity(pullRequest);
    const languages = this.detectLanguages(pullRequest.files);
    const patterns = this.identifyPatterns(pullRequest);
    const focusAreas = options.focusAreas || this.suggestFocusAreas(pullRequest);

    return {
      pullRequest,
      changes,
      complexity,
      languages,
      patterns,
      focusAreas,
      questionCount: options.questionCount || 10,
      difficulty: options.difficulty || 'mixed',
    };
  }

  /**
   * AIサービスを使用してクイズを生成
   */
  async generateQuestions(context: QuizContext): Promise<Question[]> {
    return this.aiService.generateQuestions(context);
  }

  /**
   * ファイル変更の分析
   */
  private analyzeChanges(files: PRFile[]): CodeChange[] {
    return files.map(file => ({
      type: file.status,
      filename: file.filename,
      language: file.language || 'unknown',
      linesChanged: file.additions + file.deletions,
      complexity: this.calculateFileComplexity(file),
      summary: this.summarizeFileChanges(file),
    }));
  }

  /**
   * PR全体の複雑度を計算
   */
  private calculateComplexity(pullRequest: PullRequest): number {
    const fileCount = pullRequest.files.length;
    const totalLines = pullRequest.files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
    const commitCount = pullRequest.commits.length;

    // シンプルな複雑度計算（0-100のスケール）
    return Math.min(100, (fileCount * 10) + (totalLines / 10) + (commitCount * 5));
  }

  /**
   * ファイルの複雑度を計算
   */
  private calculateFileComplexity(file: PRFile): number {
    const lineChanges = file.additions + file.deletions;
    return Math.min(10, Math.floor(lineChanges / 10));
  }

  /**
   * 使用言語を検出
   */
  private detectLanguages(files: PRFile[]): string[] {
    const languages = new Set(files.map(file => file.language).filter((lang): lang is string => Boolean(lang)));
    return Array.from(languages);
  }

  /**
   * コードパターンを特定
   */
  private identifyPatterns(pullRequest: PullRequest): string[] {
    const patterns = new Set<string>();

    pullRequest.files.forEach(file => {
      if (file.filename.includes('test')) patterns.add('testing');
      if (file.filename.includes('api')) patterns.add('api');
      if (file.filename.includes('component')) patterns.add('component');
      if (file.filename.includes('service')) patterns.add('service');
      if (file.patch?.includes('async')) patterns.add('async');
      if (file.patch?.includes('await')) patterns.add('async');
      if (file.patch?.includes('useState')) patterns.add('react-hooks');
      if (file.patch?.includes('useEffect')) patterns.add('react-hooks');
    });

    return Array.from(patterns);
  }

  /**
   * フォーカス領域を提案
   */
  private suggestFocusAreas(pullRequest: PullRequest): FocusArea[] {
    const areas: FocusArea[] = [];

    // デフォルトの重点領域
    areas.push({ type: 'logic', weight: 0.3 });
    areas.push({ type: 'syntax', weight: 0.2 });
    areas.push({ type: 'best-practices', weight: 0.3 });

    // ファイル内容に基づく調整
    const hasSecurityChanges = pullRequest.files.some(file => 
      file.patch?.includes('password') || file.patch?.includes('token') || file.patch?.includes('auth')
    );
    if (hasSecurityChanges) {
      areas.push({ type: 'security', weight: 0.2 });
    }

    const hasPerformanceChanges = pullRequest.files.some(file =>
      file.patch?.includes('performance') || file.patch?.includes('optimize') || file.patch?.includes('cache')
    );
    if (hasPerformanceChanges) {
      areas.push({ type: 'performance', weight: 0.2 });
    }

    return areas;
  }

  /**
   * ファイル変更の要約
   */
  private summarizeFileChanges(file: PRFile): string {
    const { status, additions, deletions } = file;
    return `${status} file with ${additions} additions and ${deletions} deletions`;
  }
}
