import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Question, PullRequest, QuizConfig, FocusArea, LocalLLMConfig } from '@/types';
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
  type: 'added' | 'modified' | 'deleted';
  filename: string;
  language: string;
  linesChanged: number;
  complexity: number;
  summary: string;
}

// AI サービスエラー
export class AIServiceError extends Error {
  public provider: string;
  public details?: any;
  
  constructor(
    message: string,
    provider: string,
    details?: any
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

      const content = response.data.choices[0].message.content;
      return this.parseResponse(content, context.questionCount);
    } catch (error: any) {
      throw new AIServiceError(
        `OpenAI API error: ${error.response?.data?.error?.message || error.message}`,
        'openai',
        error.response?.data
      );
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
      const patchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
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

      return questions.slice(0, questionCount).map((q: any, index: number) => ({
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
    } catch (error) {
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

      const content = response.data.candidates[0].content.parts[0].text;
      return this.parseResponse(content, context.questionCount);
    } catch (error: any) {
      throw new AIServiceError(
        `Google AI API error: ${error.response?.data?.error?.message || error.message}`,
        'google',
        error.response?.data
      );
    }
  }

  private buildPrompt(context: QuizContext): string {
    const { pullRequest, changes, focusAreas, questionCount, difficulty } = context;

    const focusAreaText = focusAreas.map(area => `${area.type} (重要度: ${area.weight})`).join(', ');
    
    const changesText = changes.map(change => 
      `- ${change.filename} (${change.language}): ${change.type}, ${change.linesChanged}行変更, 複雑度: ${change.complexity}`
    ).join('\n');

    const filesText = pullRequest.files.slice(0, 5).map(file => {
      const patchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
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

      return questions.slice(0, questionCount).map((q: any, index: number) => ({
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
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
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

      const content = response.data.response;
      return this.parseResponse(content, context.questionCount);
    } catch (error: any) {
      throw new AIServiceError(
        `Local LLM error: ${error.response?.data?.error || error.message}`,
        'local',
        error.response?.data
      );
    }
  }

  private buildPrompt(context: QuizContext): string {
    const { pullRequest, changes, focusAreas, questionCount, difficulty } = context;

    const focusAreaText = focusAreas.map(area => `${area.type} (重要度: ${area.weight})`).join(', ');
    
    const changesText = changes.map(change => 
      `- ${change.filename} (${change.language}): ${change.type}, ${change.linesChanged}行変更, 複雑度: ${change.complexity}`
    ).join('\n');

    const filesText = pullRequest.files.slice(0, 5).map(file => {
      const patchPreview = file.patch ? file.patch.split('\n').slice(0, 20).join('\n') : '';
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

      return questions.slice(0, questionCount).map((q: any, index: number) => ({
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
  private analyzeChanges(files: any[]): CodeChange[] {
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
  private calculateFileComplexity(file: any): number {
    const lineChanges = file.additions + file.deletions;
    return Math.min(10, Math.floor(lineChanges / 10));
  }

  /**
   * 使用言語を検出
   */
  private detectLanguages(files: any[]): string[] {
    const languages = new Set(files.map(file => file.language).filter(Boolean));
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
  private summarizeFileChanges(file: any): string {
    const { status, additions, deletions } = file;
    return `${status} file with ${additions} additions and ${deletions} deletions`;
  }
}
