import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { PullRequest, PRFile, Commit, Review } from '@/types';
import { env } from '@/utils/env';

// GitHub API レスポンスの型定義
interface GitHubPRResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

interface GitHubFileResponse {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
}

interface GitHubReviewResponse {
  id: number;
  user: {
    login: string;
  };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  body: string;
  submitted_at: string;
}

// PR URL情報の型
interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

// GitHub API エラー
export class GitHubAPIError extends Error {
  public statusCode: number;
  public details?: any;
  
  constructor(
    message: string,
    statusCode: number,
    details?: any
  ) {
    super(message);
    this.name = 'GitHubAPIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// GitHub API クライアント
export class GitHubService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.github.apiUrl,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': `${env.app.title}/${env.app.version}`,
      },
      timeout: 30000,
    });

    // GitHubトークンが設定されている場合は認証ヘッダーを追加
    if (env.github.token) {
      this.client.defaults.headers.common['Authorization'] = `token ${env.github.token}`;
    }

    // レスポンスインターセプターでエラーハンドリング
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new GitHubAPIError(
            error.response.data?.message || 'GitHub API error',
            error.response.status,
            error.response.data
          );
        }
        throw error;
      }
    );
  }

  /**
   * PR URLからオーナー、リポジトリ、PR番号を抽出
   */
  extractPRInfo(prUrl: string): PRInfo {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = prUrl.match(regex);

    if (!match) {
      throw new Error(`Invalid PR URL: ${prUrl}. Expected format: https://github.com/owner/repo/pull/123`);
    }

    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3], 10),
    };
  }

  /**
   * GitHub APIからPR情報を取得
   */
  async getPullRequest(owner: string, repo: string, number: number): Promise<GitHubPRResponse> {
    try {
      const response: AxiosResponse<GitHubPRResponse> = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${number}`
      );
      return response.data;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError('Failed to fetch pull request', 500, error);
    }
  }

  /**
   * GitHub APIからPRのファイルリストを取得
   */
  async getPRFiles(owner: string, repo: string, number: number): Promise<GitHubFileResponse[]> {
    try {
      const response: AxiosResponse<GitHubFileResponse[]> = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${number}/files`
      );
      return response.data;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError('Failed to fetch pull request files', 500, error);
    }
  }

  /**
   * GitHub APIからPRのコミットリストを取得
   */
  async getPRCommits(owner: string, repo: string, number: number): Promise<GitHubCommitResponse[]> {
    try {
      const response: AxiosResponse<GitHubCommitResponse[]> = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${number}/commits`
      );
      return response.data;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError('Failed to fetch pull request commits', 500, error);
    }
  }

  /**
   * GitHub APIからPRのレビューを取得
   */
  async getPRReviews(owner: string, repo: string, number: number): Promise<GitHubReviewResponse[]> {
    try {
      const response: AxiosResponse<GitHubReviewResponse[]> = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${number}/reviews`
      );
      return response.data;
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError('Failed to fetch pull request reviews', 500, error);
    }
  }

  /**
   * ファイル名から言語を推定
   */
  private detectLanguage(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'md': 'markdown',
      'json': 'json',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'bash',
      'sql': 'sql',
    };

    return extension ? languageMap[extension] || 'text' : 'text';
  }

  /**
   * GitHub APIレスポンスを内部のPullRequest型に変換
   */
  async parsePullRequest(prUrl: string): Promise<PullRequest> {
    const { owner, repo, number } = this.extractPRInfo(prUrl);

    // 並列でデータを取得
    const [prData, files, commits, reviews] = await Promise.all([
      this.getPullRequest(owner, repo, number),
      this.getPRFiles(owner, repo, number),
      this.getPRCommits(owner, repo, number),
      this.getPRReviews(owner, repo, number),
    ]);

    // ファイル情報の変換
    const parsedFiles: PRFile[] = files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      language: this.detectLanguage(file.filename),
    }));

    // コミット情報の変換
    const parsedCommits: Commit[] = commits.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: new Date(commit.commit.author.date),
      },
    }));

    // レビュー情報の変換
    const parsedReviews: Review[] = reviews.map((review) => ({
      id: review.id.toString(),
      user: review.user.login,
      state: review.state,
      body: review.body,
      submittedAt: new Date(review.submitted_at),
    }));

    // PullRequest オブジェクトの構築
    const pullRequest: PullRequest = {
      id: `${owner}/${repo}#${number}`,
      number,
      title: prData.title,
      description: prData.body || '',
      author: prData.user.login,
      repository: {
        owner,
        name: repo,
      },
      files: parsedFiles,
      commits: parsedCommits,
      reviews: parsedReviews,
      createdAt: new Date(prData.created_at),
      updatedAt: new Date(prData.updated_at),
    };

    return pullRequest;
  }

  /**
   * API接続をテスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/user');
      return true;
    } catch (error) {
      console.debug('GitHub API connection test failed:', error);
      return false;
    }
  }

  /**
   * レート制限情報を取得
   */
  async getRateLimit(): Promise<any> {
    try {
      const response = await this.client.get('/rate_limit');
      return response.data;
    } catch (error) {
      throw new GitHubAPIError('Failed to get rate limit', 500, error);
    }
  }
}

// デフォルトインスタンス
export const githubService = new GitHubService();
