## 5. Phase 3: ツール実装

### 5.1 GitHub PR取得ツール (src/tools/github-pr-tool.ts)

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { ParsedPRUrl, PRInfo, FileChange } from "@/types/github.types";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const githubPRTool = createTool({
  id: "fetch-github-pr",
  description: "Fetch pull request information and changes from GitHub",
  inputSchema: z.object({
    url: z.string().url().describe("GitHub PR URL"),
  }),
  outputSchema: z.object({
    prInfo: z.object({
      title: z.string(),
      description: z.string(),
      author: z.string(),
      baseRef: z.string(),
      headRef: z.string(),
      changedFiles: z.number(),
      additions: z.number(),
      deletions: z.number(),
      state: z.enum(['open', 'closed', 'merged']),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
    files: z.array(z.object({
      filename: z.string(),
      status: z.enum(['added', 'modified', 'removed', 'renamed']),
      additions: z.number(),
      deletions: z.number(),
      patch: z.string().optional(),
      previousFilename: z.string().optional(),
    })),
    diffContent: z.string(),
  }),
  execute: async ({ context }) => {
    const parsed = parsePRUrl(context.url);
    
    // PR基本情報の取得
    const { data: pr } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
    });
    
    // 変更ファイルの取得
    const { data: files } = await octokit.pulls.listFiles({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
      per_page: 100, // 最大100ファイル
    });
    
    // diffの取得
    const { data: diffData } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repo,
      pull_number: parsed.pullNumber,
      mediaType: { format: "diff" },
    });
    
    const prInfo: PRInfo = {
      title: pr.title,
      description: pr.body || "",
      author: pr.user?.login || "unknown",
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
      changedFiles: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
      state: pr.state === 'open' ? 'open' : pr.merged ? 'merged' : 'closed',
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
    };
    
    const fileChanges: FileChange[] = files.map(file => ({
      filename: file.filename,
      status: file.status as FileChange['status'],
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
      previousFilename: file.previous_filename,
    }));
    
    return {
      prInfo,
      files: fileChanges,
      diffContent: diffData as unknown as string,
    };
  },
});

function parsePRUrl(url: string): ParsedPRUrl {
  const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error("Invalid GitHub PR URL format");
  }
  
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: parseInt(match[3], 10),
  };
}
```

### 5.2 Diff解析ツール (src/tools/diff-analyzer-tool.ts)

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import parseDiff from "parse-diff";
import type { DiffAnalysis } from "@/types/github.types";

export const diffAnalyzerTool = createTool({
  id: "analyze-diff",
  description: "Analyze PR diff to understand the nature of changes",
  inputSchema: z.object({
    diffContent: z.string(),
    files: z.array(z.object({
      filename: z.string(),
      status: z.string(),
      additions: z.number(),
      deletions: z.number(),
      patch: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    analysis: z.object({
      summary: z.string(),
      changeType: z.enum(['bug_fix', 'feature', 'refactor', 'documentation', 'test', 'other']),
      impactLevel: z.enum(['low', 'medium', 'high']),
      keyChanges: z.array(z.string()),
      filesAnalyzed: z.number(),
    }),
    parsedDiff: z.array(z.any()),
  }),
  execute: async ({ context }) => {
    const { diffContent, files } = context;
    
    // Diffのパース
    const parsedDiff = parseDiff(diffContent);
    
    // 変更タイプの推定
    const changeType = inferChangeType(files, parsedDiff);
    
    // 影響レベルの評価
    const impactLevel = assessImpactLevel(files);
    
    // 主要な変更点の抽出
    const keyChanges = extractKeyChanges(parsedDiff, files);
    
    const analysis: DiffAnalysis = {
      summary: generateSummary(files, changeType),
      changeType,
      impactLevel,
      keyChanges,
      filesAnalyzed: files.length,
    };
    
    return {
      analysis,
      parsedDiff,
    };
  },
});

function inferChangeType(files: any[], parsedDiff: any[]): DiffAnalysis['changeType'] {
  const filenames = files.map(f => f.filename.toLowerCase());
  
  // テストファイルの変更が主な場合
  if (filenames.some(f => f.includes('test') || f.includes('spec'))) {
    const testFiles = filenames.filter(f => f.includes('test') || f.includes('spec'));
    if (testFiles.length > files.length * 0.5) return 'test';
  }
  
  // ドキュメントの変更
  if (filenames.some(f => f.endsWith('.md') || f.includes('doc'))) {
    const docFiles = filenames.filter(f => f.endsWith('.md') || f.includes('doc'));
    if (docFiles.length > files.length * 0.5) return 'documentation';
  }
  
  // バグ修正の可能性（小規模な変更）
  const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (totalChanges < 50 && files.length <= 3) return 'bug_fix';
  
  // リファクタリング（削除が多い）
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  if (totalDeletions > totalAdditions * 0.8 && totalDeletions > 100) return 'refactor';
  
  // 新機能（追加が多い）
  if (totalAdditions > totalDeletions * 1.5) return 'feature';
  
  return 'other';
}

function assessImpactLevel(files: any[]): DiffAnalysis['impactLevel'] {
  const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const fileCount = files.length;
  
  if (totalChanges > 500 || fileCount > 10) return 'high';
  if (totalChanges > 100 || fileCount > 5) return 'medium';
  return 'low';
}

function extractKeyChanges(parsedDiff: any[], files: any[]): string[] {
  const keyChanges: string[] = [];
  
  // 各ファイルから主要な変更を抽出
  parsedDiff.forEach((file) => {
    if (file.chunks) {
      file.chunks.forEach((chunk: any) => {
        // 関数の追加/削除を検出
        const addedFunctions = chunk.changes
          .filter((c: any) => c.type === 'add' && c.content.includes('function'))
          .map((c: any) => `Added function in ${file.to}`);
        
        keyChanges.push(...addedFunctions.slice(0, 2));
      });
    }
  });
  
  // 新規ファイルの追加
  const newFiles = files.filter(f => f.status === 'added');
  newFiles.forEach(f => {
    keyChanges.push(`New file: ${f.filename}`);
  });
  
  return keyChanges.slice(0, 5); // 最大5個の主要変更
}

function generateSummary(files: any[], changeType: string): string {
  const fileCount = files.length;
  const additions = files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0);
  
  return `This PR contains ${fileCount} file(s) with ${additions} additions and ${deletions} deletions. The main change type appears to be: ${changeType}.`;
}
```
