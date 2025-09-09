# 技術選定書 - スタエフ音声から動画生成アプリ

## 1. 技術選定の方針

### 1.1 選定基準
- **コスト効率**: vrewより安価な運用コスト
- **開発効率**: 既存コードベースの最大活用
- **品質**: 高品質な動画出力
- **保守性**: 長期的な運用・保守の容易さ
- **スケーラビリティ**: 将来的な機能拡張への対応

### 1.2 制約条件
- Next.js 14 + TypeScript環境での開発
- Vercelでのデプロイ（サーバーレス環境）
- 既存のOpenAI APIとの連携

## 2. 動画生成技術の選定

### 2.1 候補技術の比較

| 技術 | コスト | 開発難易度 | 品質 | Vercel対応 | 推奨度 |
|------|--------|------------|------|------------|--------|
| **FFmpeg + Node.js** | 低 | 中 | 高 | △ | ⭐⭐⭐⭐ |
| **Remotion** | 中 | 低 | 高 | ○ | ⭐⭐⭐⭐⭐ |
| **Canvas API + MediaRecorder** | 低 | 高 | 中 | ○ | ⭐⭐⭐ |
| **外部動画生成API** | 高 | 低 | 高 | ○ | ⭐⭐ |

### 2.2 推奨技術: **Remotion**

#### 選定理由
1. **React-based**: 既存のReact/TypeScriptスキルを活用可能 <mcreference link="https://www.remotion.dev/blog/1-3" index="1">1</mcreference>
2. **プログラマティック動画生成**: コードで動画を定義・生成
3. **Vercel対応**: サーバーレス環境での動画生成に対応
4. **高品質出力**: FFmpegベースで高品質な動画出力 <mcreference link="https://www.remotion.dev/blog/1-3" index="1">1</mcreference>
5. **コスト効率**: 従量課金でスケーラブル

#### 技術仕様
```typescript
// Remotionでの動画コンポーネント例
import { Composition } from 'remotion';

export const VideoComposition: React.FC = () => {
  return (
    <Composition
      id="StandFMVideo"
      component={StandFMVideoComponent}
      durationInFrames={3000} // 100秒 (30fps)
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
```

### 2.3 代替案: **FFmpeg + Node.js**

#### 使用ケース
- Remotionでの処理が重い場合のフォールバック
- より細かい動画制御が必要な場合

#### 実装方針
```javascript
// FFmpegでのキャプション付き動画生成例
const ffmpeg = require('fluent-ffmpeg');

ffmpeg(audioFile)
  .input(backgroundVideo)
  .videoFilters([
    'subtitles=captions.srt:force_style=\'FontSize=24,PrimaryColour=&Hffffff&\''
  ])
  .output('output.mp4')
  .run();
```

## 3. 素材取得技術の選定

### 3.1 無料素材API

#### **Pexels API** (推奨)
- **コスト**: 完全無料 <mcreference link="https://www.pexels.com/ja-jp/api/" index="1">1</mcreference>
- **ライセンス**: CC0（クレジット表記不要） <mcreference link="https://co-jin.net/movie/pexels-videos" index="3">3</mcreference>
- **素材数**: 豊富な動画・画像素材 <mcreference link="https://service.aainc.co.jp/product/letrostudio/article/video-image-royaltyfree-site" index="2">2</mcreference>
- **API制限**: デフォルト制限あり（無料で引き上げ可能） <mcreference link="https://www.pexels.com/ja-jp/api/" index="1">1</mcreference>

```typescript
// Pexels API使用例
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const searchVideos = async (query: string) => {
  const response = await fetch(
    `https://api.pexels.com/videos/search?query=${query}&per_page=10`,
    {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    }
  );
  return response.json();
};
```

#### **Unsplash API** (画像素材)
- **用途**: 静止画像素材の取得
- **ライセンス**: Unsplash License（商用利用可）
- **API制限**: 月50リクエスト（無料）

### 3.2 AI生成素材

#### **OpenAI DALL-E 3** (既存利用)
- **用途**: カスタム画像生成
- **コスト**: $0.040 per image (1024×1024)
- **品質**: 高品質なAI生成画像

## 4. キャプション生成技術

### 4.1 文字起こし（既存活用）
- **OpenAI Whisper API**: 既存実装を活用
- **精度**: 95%以上の高精度日本語認識

### 4.2 キャプション同期

#### **SRT形式での実装**
```typescript
// SRTキャプション生成
interface Caption {
  start: number; // 秒
  end: number;   // 秒
  text: string;
}

const generateSRT = (captions: Caption[]): string => {
  return captions.map((caption, index) => {
    const startTime = formatTime(caption.start);
    const endTime = formatTime(caption.end);
    return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`;
  }).join('\n');
};
```

#### **Remotionでのキャプション表示**
```typescript
// Remotionでのキャプション表示コンポーネント
import { useCurrentFrame, useVideoConfig } from 'remotion';

const CaptionOverlay: React.FC<{captions: Caption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTime = frame / fps;
  
  const currentCaption = captions.find(
    caption => currentTime >= caption.start && currentTime <= caption.end
  );
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px 20px',
      borderRadius: 8,
      fontSize: 24,
      fontWeight: 'bold'
    }}>
      {currentCaption?.text}
    </div>
  );
};
```

## 5. アーキテクチャ設計

### 5.1 システム構成

```
[フロントエンド - Next.js]
├── 音声アップロード (既存AudioUpload改修)
├── 動画設定フォーム (新規VideoSettingsForm)
├── プレビュー画面 (新規VideoPreview)
└── ダウンロード画面 (新規VideoDownload)

[API Routes]
├── /api/transcribe (既存)
├── /api/analyze-content (新規)
├── /api/fetch-assets (新規)
├── /api/generate-video (新規)
└── /api/render-video (新規)

[外部サービス]
├── OpenAI (Whisper, GPT-4)
├── Pexels API (動画・画像素材)
├── Remotion Cloud (動画レンダリング)
└── Vercel (ホスティング)
```

### 5.2 データフロー

1. **音声入力** → 既存AudioUploadコンポーネント
2. **文字起こし** → 既存/api/transcribe
3. **コンテンツ解析** → /api/analyze-content (GPT-4でキーワード抽出)
4. **素材取得** → /api/fetch-assets (Pexels API)
5. **動画構成** → Remotionコンポーネント設計
6. **動画生成** → /api/generate-video (Remotion)
7. **レンダリング** → /api/render-video (Remotion Cloud)
8. **配信** → Vercel CDN

## 6. 開発環境・ツール

### 6.1 追加パッケージ

```json
{
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/lambda": "^4.0.0",
    "fluent-ffmpeg": "^2.1.2",
    "srt-parser-2": "^1.2.3"
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.21"
  }
}
```

### 6.2 環境変数

```bash
# 既存
OPENAI_API_KEY=your_openai_key

# 新規追加
PEXELS_API_KEY=your_pexels_key
REMOTION_APP_REGION=us-east-1
REMOTION_APP_FUNCTION_NAME=remotion-render
```

## 7. コスト試算

### 7.1 月間100動画生成時のコスト比較

| サービス | コスト/動画 | 月間コスト | 備考 |
|----------|-------------|------------|------|
| **vrew** | ¥500-1000 | ¥50,000-100,000 | 既存ツール |
| **提案システム** | ¥50-150 | ¥5,000-15,000 | 70-85%削減 |

### 7.2 提案システムの内訳

- **OpenAI Whisper**: $0.006/分 → 5分音声で$0.03 (¥4.5)
- **OpenAI GPT-4**: $0.03/1K tokens → 分析で$0.30 (¥45)
- **Pexels API**: 無料
- **Remotion Cloud**: $0.01/秒 → 100秒動画で$1.00 (¥150)
- **Vercel**: 従量課金（微小）

**合計**: 約¥200/動画 (5分音声、100秒動画の場合)

## 8. リスク対策

### 8.1 技術リスク

1. **Remotion処理時間**: 長時間処理によるタイムアウト
   - **対策**: 処理の分割、非同期処理、進捗表示

2. **素材の品質**: 自動選択素材の適切性
   - **対策**: GPT-4による関連度スコアリング、手動選択オプション

3. **キャプション同期**: 音声とテキストの同期精度
   - **対策**: Whisperのタイムスタンプ活用、手動調整機能

### 8.2 運用リスク

1. **API制限**: 外部API使用量制限
   - **対策**: 複数API併用、キャッシュ機能、使用量監視

2. **コスト増加**: 予想以上のAPI使用料
   - **対策**: 使用量アラート、月次上限設定

## 9. 実装優先度

### 9.1 Phase 1 (MVP)
- Remotion基本セットアップ
- 簡単な動画生成（音声 + 静止画 + キャプション）
- YouTube横長フォーマット対応

### 9.2 Phase 2
- Pexels API連携
- 自動素材選択機能
- TikTok縦長フォーマット対応

### 9.3 Phase 3
- 高度なエフェクト・トランジション
- カスタマイズ機能拡張
- パフォーマンス最適化

## 10. 結論

**Remotion + Pexels API + 既存OpenAI連携**の組み合わせにより、vrewの70-85%のコスト削減を実現しつつ、高品質な動画生成が可能。既存のNext.js + TypeScript環境を最大限活用し、段階的な開発により確実な実装を進める。