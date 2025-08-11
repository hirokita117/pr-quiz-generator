このリポジトリは 95% ほど AI に書いてもらっています。

# PR Quiz Generator

GitHub プルリクエストからクイズを生成するWebアプリケーション

## 🚀 セットアップ完了項目

### ✅ プロジェクト初期設定
- Vite (React + TypeScript) プロジェクト作成
- 不要なボイラープレートコードの削除

### ✅ ライブラリ導入
- **shadcn/ui**: モダンなUIコンポーネントライブラリ
- **zustand**: 軽量な状態管理
- **axios**: HTTPクライアント
- **Tailwind CSS**: ユーティリティファーストCSS

### ✅ 基本的なファイル構造
```
src/
├── components/     # 再利用可能なUIコンポーネント
│   └── ui/        # shadcn/ui コンポーネント
├── services/      # API連携やビジネスロジック
├── types/         # 型定義ファイル
├── store/         # Zustandストア
├── hooks/         # カスタムフック
└── utils/         # ユーティリティ関数
```

### ✅ 型定義の設定
- `PullRequest`, `PRFile`, `Quiz`, `Question` などの基本インターフェース
- AIプロバイダーと設定関連の型定義
- UI状態管理用の型定義

### ✅ 環境変数の設定
- `.env.example` ファイル作成
- GitHub、OpenAI、Google AI APIの設定テンプレート
- 型安全な環境変数読み込みユーティリティ

## 🛠️ 開発環境

### 前提条件
- Node.js 20 LTS
- npm または pnpm

### 起動方法
```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

### 環境変数設定
1. `.env.example` を `.env` にコピー
2. 必要なAPIキーを設定

```bash
cp .env.example .env
```

## 📦 技術スタック

| カテゴリー | 技術選定 |
|---|---|
| **フレームワーク** | React 18 + TypeScript |
| **ビルドツール** | Vite |
| **スタイリング** | Tailwind CSS + shadcn/ui |
| **状態管理** | Zustand |
| **HTTPクライアント** | Axios |
| **アイコン** | Lucide React |

## 📄 対応ファイル拡張子

現在サポートしている拡張子と言語の対応は次のとおりです。

| 拡張子 | 言語 |
|---|---|
| `.js` | JavaScript |
| `.jsx` | JavaScript |
| `.ts` | TypeScript |
| `.tsx` | TypeScript |
| `.py` | Python |
| `.java` | Java |
| `.cpp` | C++ |
| `.c` | C |
| `.cs` | C# |
| `.php` | PHP |
| `.rb` | Ruby |
| `.go` | Go |
| `.rs` | Rust |
| `.swift` | Swift |
| `.kt` | Kotlin |
| `.scala` | Scala |
| `.html` | HTML |
| `.css` | CSS |
| `.scss` | SCSS |
| `.sass` | SASS |
| `.md` | Markdown |
| `.json` | JSON |
| `.xml` | XML |
| `.yml` | YAML |
| `.yaml` | YAML |
| `.sh` | Bash |
| `.sql` | SQL |

対応表の実装は `src/services/github.ts` の `detectLanguage` を参照してください。
