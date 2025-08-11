# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PR Quiz Generator - A web application that generates programming quizzes from GitHub Pull Requests using AI. It analyzes code changes and creates educational quizzes to help developers understand the changes.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Zustand for global state management
- **API**: Axios for HTTP requests

### Key Directories
- `src/components/`: React components including UI primitives and feature components
- `src/services/`: Business logic - GitHub API integration (`github.ts`) and AI services (`ai.ts`)
- `src/store/`: Zustand store (`useQuizStore.ts`) managing application state
- `src/types/`: TypeScript type definitions for all data structures

### AI Service Architecture
The app supports multiple AI providers through a factory pattern:
- **OpenAI**: GPT-4 models via OpenAI API
- **Google AI**: Gemini models (2.0-flash-lite, 2.5-flash, 2.5-pro)
- **Ollama**: Local LLM support

All AI services implement a common `AIService` interface defined in `src/types/index.ts`. New providers can be added by implementing this interface and registering in `src/services/ai.ts`.

### GitHub Integration
The GitHub service (`src/services/github.ts`) handles:
- PR URL parsing and validation
- Fetching PR metadata, file changes, commits, and reviews
- Rate limiting and authentication
- Security sanitization of sensitive data in code patches

### State Management Pattern
The Zustand store manages:
- Quiz generation state and results
- AI provider settings (persisted to localStorage)
- Loading and error states
- User preferences (question count, difficulty, focus areas)

## Important Considerations

### Environment Variables
All environment variables are prefixed with `VITE_` and accessed through `src/utils/env.ts`:
- `VITE_GITHUB_TOKEN`: Optional for higher GitHub API rate limits
- `VITE_OPENAI_API_KEY`: Required for OpenAI provider
- `VITE_GOOGLE_API_KEY`: Required for Google AI provider
- `VITE_LOCAL_LLM_ENDPOINT`: Ollama endpoint (default: http://localhost:11434)

### Type Safety
The codebase uses comprehensive TypeScript types. Key interfaces:
- `PullRequestData`: GitHub PR structure
- `Quiz`, `Question`: Quiz data structures
- `AIService`: Common AI service interface
- `QuizStore`: Zustand store type

### Error Handling
Custom error classes in `src/types/index.ts`:
- `GitHubAPIError`: GitHub API-specific errors
- `AIServiceError`: AI service errors

All async operations should handle these appropriately and update the store's error state.

### Security
The `sanitizeSensitiveData` function in `src/services/github.ts` removes sensitive information from code patches before sending to AI services. This includes API keys, tokens, and passwords.

### UI Components
Using shadcn/ui components in `src/components/ui/`. These are pre-styled Radix UI primitives. When adding new UI elements, check if a suitable component already exists before creating custom ones.

### Japanese Interface
The UI is primarily in Japanese. Maintain consistency with existing Japanese text in components and error messages.

## Communication Preferences

### Language Settings
- **User Communication**: Always respond to users in Japanese (日本語でユーザーとやり取りしてください)
- **Internal Thinking**: Continue thinking in English for optimal performance (思考は英語で行ってください)
- **Code Comments**: Follow existing codebase conventions (typically English for code comments)

この設定により、ユーザーとの対話は日本語で行いながら、内部的な思考プロセスは英語で維持することで、最適なパフォーマンスを保ちます。