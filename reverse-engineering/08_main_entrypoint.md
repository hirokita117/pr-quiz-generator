## 10. Phase 8: メインエントリーポイント

### 10.1 サーバー起動 (src/index.ts)

```typescript
import { Mastra } from "@mastra/core";
import { prQuizWorkflow } from "./workflows/pr-quiz-workflow";
import { quizGeneratorAgent } from "./agents/quiz-generator-agent";
import express from "express";
import { createServer } from "vite";

async function startServer() {
  // Mastraインスタンスの作成
  const mastra = new Mastra({
    workflows: [prQuizWorkflow],
    agents: [quizGeneratorAgent],
    serverPort: parseInt(process.env.MASTRA_SERVER_PORT || '4111'),
  });

  // Mastra APIの起動
  await mastra.start();
  console.log(`🚀 Mastra API running on http://localhost:${process.env.MASTRA_SERVER_PORT || '4111'}`);
  console.log(`🎮 Playground available at http://localhost:${process.env.MASTRA_SERVER_PORT || '4111'}/`);

  // Vite開発サーバーの起動（UI用）
  const app = express();
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const uiPort = 3000;
  app.listen(uiPort, () => {
    console.log(`🖥️  UI available at http://localhost:${uiPort}`);
  });
}

startServer().catch(console.error);
```
