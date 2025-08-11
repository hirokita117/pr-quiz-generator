## 11. テスト仕様

### 11.1 単体テスト例 (tests/tools/github-pr-tool.test.ts)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { githubPRTool } from '@/tools/github-pr-tool';

describe('GitHub PR Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse valid GitHub PR URL', async () => {
    const url = 'https://github.com/facebook/react/pull/12345';
    const result = await githubPRTool.execute({
      context: { url },
    });
    
    expect(result.prInfo).toBeDefined();
    expect(result.files).toBeInstanceOf(Array);
  });

  it('should throw error for invalid URL', async () => {
    const url = 'https://example.com/invalid';
    
    await expect(githubPRTool.execute({
      context: { url },
    })).rejects.toThrow('Invalid GitHub PR URL format');
  });
});
```
