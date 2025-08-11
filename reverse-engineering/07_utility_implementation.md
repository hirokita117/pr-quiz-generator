## 9. Phase 7: ユーティリティ実装

### 9.1 キャッシュマネージャー (src/utils/cache-manager.ts)

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 3600000; // 1時間

  constructor() {
    if (process.env.QUIZ_CACHE_TTL) {
      this.defaultTTL = parseInt(process.env.QUIZ_CACHE_TTL);
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (process.env.QUIZ_CACHE_ENABLED !== 'true') return;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get<T>(key: string): T | null {
    if (process.env.QUIZ_CACHE_ENABLED !== 'true') return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  // PR URLをキーに変換
  generatePRKey(url: string, settings?: any): string {
    const base = url.replace(/[^a-zA-Z0-9]/g, '_');
    const settingsKey = settings ? JSON.stringify(settings) : '';
    return `pr_${base}_${settingsKey}`;
  }
}

export const cacheManager = new CacheManager();
```
