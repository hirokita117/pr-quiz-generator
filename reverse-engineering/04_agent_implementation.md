## 6. Phase 4: エージェント実装

### 6.1 Gemini設定 (src/config/gemini-config.ts)

```typescript
import { google } from "@ai-sdk/google";

export const geminiModel = google("gemini-1.5-flash", {
  safetySettings: [
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_NONE",
    },
  ],
});

export const geminiConfig = {
  temperature: 0.7,
  maxTokens: 4000,
  topP: 0.9,
};
```

### 6.2 クイズ生成エージェント (src/agents/quiz-generator-agent.ts)

```typescript
import { Agent } from "@mastra/core/agent";
import { geminiModel, geminiConfig } from "@/config/gemini-config";
import type { QuizQuestion, DifficultyLevel, QuizType } from "@/types/quiz.types";

export const quizGeneratorAgent = new Agent({
  name: "Quiz Generator",
  instructions: `
    You are an expert programming educator who creates insightful quiz questions based on GitHub pull request changes.
    
    Your task is to generate educational quiz questions that test understanding of:
    1. The purpose and impact of code changes
    2. Programming concepts demonstrated in the changes
    3. Best practices and potential improvements
    4. Edge cases and error handling
    
    Guidelines for quiz generation:
    - Create diverse question types (multiple choice, true/false, fill-in-the-blank, open-ended)
    - Vary difficulty levels based on the complexity of changes
    - Include code snippets when relevant
    - Provide clear, educational explanations for each answer
    - Focus on learning outcomes rather than trivial details
    - Questions should be in Japanese unless the code comments are in English
    
    For each question, provide:
    - A clear, unambiguous question
    - Correct answer with detailed explanation
    - For multiple choice: 3-4 plausible distractors
    - Context from the actual code when helpful
    - Difficulty assessment (beginner/intermediate/advanced)
  `,
  model: geminiModel,
  modelSettings: geminiConfig,
});

export async function generateQuizQuestions(
  prInfo: any,
  diffAnalysis: any,
  settings: {
    questionCount: number;
    difficulty?: DifficultyLevel;
    types?: QuizType[];
  }
): Promise<QuizQuestion[]> {
  const prompt = buildQuizPrompt(prInfo, diffAnalysis, settings);
  
  const response = await quizGeneratorAgent.generate(prompt);
  
  // レスポンスをパースしてQuizQuestion[]に変換
  return parseQuizResponse(response.text);
}

function buildQuizPrompt(prInfo: any, diffAnalysis: any, settings: any): string {
  return `
    Pull Request Information:
    - Title: ${prInfo.title}
    - Description: ${prInfo.description}
    - Files Changed: ${prInfo.changedFiles}
    - Change Type: ${diffAnalysis.changeType}
    - Impact Level: ${diffAnalysis.impactLevel}
    
    Key Changes:
    ${diffAnalysis.keyChanges.join('\n')}
    
    Generate ${settings.questionCount} quiz questions based on these changes.
    ${settings.difficulty ? `Focus on ${settings.difficulty} level questions.` : 'Include a mix of difficulty levels.'}
    ${settings.types ? `Use these question types: ${settings.types.join(', ')}` : 'Use various question types.'}
    
    Return the questions in the following JSON format:
    {
      "questions": [
        {
          "type": "multiple_choice|true_false|fill_blank|open_ended",
          "difficulty": "beginner|intermediate|advanced",
          "question": "質問文",
          "options": ["選択肢1", "選択肢2", ...] (multiple_choiceの場合のみ),
          "correctAnswer": "正解",
          "explanation": "解説",
          "context": "関連するコードスニペット（オプション）",
          "relatedFile": "関連ファイル名（オプション）"
        }
      ]
    }
  `;
}

function parseQuizResponse(responseText: string): QuizQuestion[] {
  try {
    // JSON部分を抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // IDを付与して返す
    return parsed.questions.map((q: any, index: number) => ({
      id: `q_${Date.now()}_${index}`,
      ...q,
    }));
  } catch (error) {
    console.error("Failed to parse quiz response:", error);
    throw new Error("クイズの生成に失敗しました");
  }
}
```
