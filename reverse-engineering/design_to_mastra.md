# GitHubプルリクエストクイズ生成システム - Mastra実装仕様書

## 1. プロジェクト概要

### 1.1 目的
パブリックなGitHubプルリクエストから学習用クイズを自動生成するローカル実行型システムの構築

### 1.2 技術スタック
- **フレームワーク**: Mastra (TypeScript)
- **LLMプロバイダー**: Google Gemini (固定)
- **UI**: React + Vite + Tailwind CSS
- **GitHub API**: Octokit
- **実行環境**: ローカルマシンのみ

## 2. プロジェクト構造

```
github-pr-quiz/
├── src/
│   ├── agents/
│   │   └── quiz-generator-agent.ts
│   ├── tools/
│   │   ├── github-pr-tool.ts
│   │   ├── diff-analyzer-tool.ts
│   │   └── quiz-formatter-tool.ts
│   ├── workflows/
│   │   └── pr-quiz-workflow.ts
│   ├── config/
│   │   ├── gemini-config.ts
│   │   └── quiz-settings.ts
│   ├── types/
│   │   ├── github.types.ts
│   │   └── quiz.types.ts
│   ├── utils/
│   │   ├── github-url-parser.ts
│   │   ├── diff-parser.ts
│   │   └── cache-manager.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── URLInput.tsx
│   │   │   ├── QuizDisplay.tsx
│   │   │   ├── QuizAnswer.tsx
│   │   │   └── ResultDisplay.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── index.ts
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── README.md
```

## 3. 実装タスク

具体的な実装タスクは以下のファイルに分割されています。

- [Phase 1: 環境構築とプロジェクトセットアップ](./01_project_setup.md)
- [Phase 2: 型定義](./02_type_definitions.md)
- [Phase 3: ツール実装](./03_tool_implementation.md)
- [Phase 4: エージェント実装](./04_agent_implementation.md)
- [Phase 5: ワークフロー実装](./05_workflow_implementation.md)
- [Phase 6: UI実装](./06_ui_implementation.md)
- [Phase 7: ユーティリティ実装](./07_utility_implementation.md)
- [Phase 8: メインエントリーポイント](./08_main_entrypoint.md)
- [Phase 9: テスト仕様](./09_testing.md)
- [Phase 10: 実行手順](./10_execution.md)


## 13. エラーハンドリング

### 13.1 主要なエラーケース

1. **GitHub API制限**
   - レート制限に達した場合は適切なエラーメッセージを表示
   - GitHub Tokenを使用してレート制限を緩和

2. **Gemini API エラー**
   - APIキーの検証
   - トークン制限への対応
   - リトライ機能の実装

3. **大規模PR対応**
   - 100ファイル以上の変更がある場合の処理
   - diff内容の要約機能
   - 段階的な処理

4. **ネットワークエラー**
   - タイムアウト設定
   - 再試行メカニズム
   - オフライン時の適切なメッセージ

## 14. 今後の拡張可能性

- **データベース統合**: 生成したクイズの永続化
- **ユーザー管理**: 学習進捗の追跡
- **統計機能**: 正答率の分析
- **エクスポート機能**: クイズのPDF/Markdown出力
- **協調学習**: 複数ユーザーでのクイズ共有
- **カスタムプロンプト**: ユーザー定義のクイズ生成ルール

## 15. セキュリティ考慮事項

- APIキーは環境変数で管理
- ローカル実行のみのため外部アクセスなし
- PRコンテンツのサニタイゼーション
- XSS対策の実装
