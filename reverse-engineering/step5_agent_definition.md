# ステップ5: Agentの作成

このステップでは、`Tool` や `Workflow` を統括し、ユーザーや外部システムからのリクエストを受け付ける窓口となる `Agent` を定義します。Agentは、特定のペルソナ（役割）と能力（ツール、ワークフロー）を持ち、自律的にタスクを遂行します。

## タスクリスト

- [ ] `Agent` クラスを用いてクイズ生成エージェントを定義する
- [ ] Agentにペルソナ（指示）と能力（ツール、ワークフロー）を割り当てる

## 詳細

### 1. Agentの定義

`src/mastra/agents/quiz-generator.ts` ファイルを作成し、以下の内容を記述します。

```typescript
import { Agent } from '@mastra/core';
import { models } from '../models'; // LLMモデル定義（後述）
import { getPullRequestDetails } from '../tools/github-pr-fetcher';
import { generateQuizFromPR } from '../tools/quiz-generator';
import { quizGenerationWorkflow } from '../workflows/quiz-generation';

export const quizGeneratorAgent = new Agent({
  name: 'quiz-generator-agent',
  
  // エージェントの役割や行動指針を自然言語で定義
  instructions: `
    あなたは、GitHubのPull Requestから教育的なクイズを生成する専門家です。
    ユーザーからPRのURLが提供されたら、以下の手順でタスクを実行してください。
    1. 'quiz-generation-workflow' を使用して、PRの内容を分析し、クイズを生成します。
    2. 生成されたクイズが、PRの変更点を的確に反映し、学習効果の高いものになっているかを確認します。
    3. 最終的なクイズデータをユーザーに返却します。
  `,
  
  // デフォルトで使用するLLMモデルを指定
  model: models.openai['gpt-4-turbo'], // 事前に定義したモデルから選択
  
  // このエージェントが直接使用できるツール
  tools: [getPullRequestDetails, generateQuizFromPR],
  
  // このエージェントが実行できるワークフロー
  workflows: [quizGenerationWorkflow],
});
```

### Agentのポイント

- **`name`**: Agentを識別するための一意の名前です。
- **`instructions`**: Agentの行動を規定するプロンプトです。どのような役割を持ち、どのように振る舞うべきかを記述します。高度な自律的判断が必要な場合、この指示が重要になります。
- **`model`**: Agentが思考や判断を行う際に使用するデフォルトのLLMモデルを指定します。これは実行時にオーバーライド可能です。
- **`tools`**: Agentが直接呼び出すことのできるToolのリストです。これにより、Agentは単純なタスクを直接実行できます。
- **`workflows`**: Agentが実行をトリガーできるWorkflowのリストです。複雑な一連の処理はWorkflowに任せることで、Agentの役割はタスクの受付と委任に集中できます。

このAgentを定義することで、UI層は「`quizGeneratorAgent`に`quizGenerationWorkflow`の実行を依頼する」という非常にシンプルな形でバックエンドロジックを呼び出せるようになります。
