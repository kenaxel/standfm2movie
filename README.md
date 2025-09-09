# スタエフ→note記事＋画像自動生成ツール

stand.fmの音声URLまたは音声ファイル（mp3, mp4, m4a, wav）をアップロードすると、自動で文字起こし→記事生成→note用Markdown出力→アイキャッチ画像生成を行うWebアプリケーションです。

## 機能

- 音声入力（mp3, mp4, m4a, wavファイル、またはstand.fmのURL）
- OpenAI Whisperによる自動文字起こし
- GPT-4による記事生成
  - 口調設定（標準、大阪弁、丁寧）
  - 目的設定（集客、教育、日記）
  - キーワード設定
  - ターゲット読者設定
- DALL-E 3によるアイキャッチ画像生成
- note用Markdown形式での出力

## 技術スタック

- **フロントエンド**: Next.js 14 + React + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes + Node.js
- **API**: OpenAI (GPT-4, Whisper, DALL-E 3)
- **ファイル処理**: Multer, FormData

## セットアップ

1. リポジトリをクローン

```bash
git clone <リポジトリURL>
cd standfm-to-note
```

2. 依存関係をインストール

```bash
npm install
```

3. 環境変数の設定

`.env.local`ファイルを作成し、以下の内容を設定:

```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. 開発サーバーを起動

```bash
npm run dev
```

5. ブラウザで http://localhost:3000 にアクセス

## 使い方

1. 音声ファイル（mp3, m4a, wav）をアップロードするか、stand.fmのURLを入力
2. 記事の設定（口調、目的、キーワードなど）を選択
3. 「記事を生成する」ボタンをクリック
4. 生成が完了すると、記事プレビューとMarkdown出力が表示される
5. Markdownをコピーしてnoteに貼り付け

## 注意事項

- 音声ファイルは最大25MB、60分以内のものに対応
- 生成には約5分かかります（文字起こし2分 + 記事生成2分 + 画像生成1分）
- OpenAI APIキーが必要です

## ライセンス

MIT





