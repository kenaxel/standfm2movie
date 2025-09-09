# アーキテクチャ設計書 - スタエフ音声から動画生成アプリ

## 1. システム全体構成

### 1.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    フロントエンド (Next.js 14)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ AudioUpload │  │VideoSettings│  │VideoPreview │  │VideoDownload│  │
│  │  (既存改修)   │  │   (新規)    │  │   (新規)    │  │   (新規)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      API Routes (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │/api/        │  │/api/analyze-│  │/api/fetch-  │  │/api/generate│  │
│  │transcribe   │  │content      │  │assets       │  │-video       │  │
│  │  (既存)     │  │   (新規)    │  │   (新規)    │  │   (新規)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      外部サービス連携                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   OpenAI    │  │  Pexels API │  │  Remotion   │  │   Vercel    │  │
│  │(Whisper,GPT)│  │ (素材取得)   │  │ (動画生成)   │  │ (ホスティング)│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 データフロー

```
音声入力 → 文字起こし → コンテンツ解析 → 素材取得 → 動画構成 → 動画生成 → 配信
    ↓         ↓          ↓         ↓        ↓        ↓       ↓
 AudioUpload  Whisper   GPT-4    Pexels   Remotion  Render  Download
```

## 2. フロントエンド設計

### 2.1 コンポーネント構成

#### 2.1.1 既存コンポーネントの改修

**AudioUpload.tsx** (既存改修)
```typescript
interface AudioUploadProps {
  onFileSelect: (file: File) => void;
  onUrlInput: (url: string) => void;
  maxSize?: number;
  acceptedFormats?: string[];
  // 新規追加
  mode: 'note' | 'video'; // モード切り替え
}
```

**SettingsForm.tsx** → **VideoSettingsForm.tsx** (改修)
```typescript
interface VideoSettings {
  // 既存設定
  tone: '標準' | '大阪弁' | '丁寧';
  targetAudience: string;
  
  // 動画専用設定
  videoFormat: 'youtube' | 'tiktok';
  aspectRatio: '16:9' | '9:16';
  duration: number; // 秒
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  captionStyle: {
    fontSize: number;
    position: 'bottom' | 'center' | 'top';
    backgroundColor: string;
    textColor: string;
  };
  backgroundMusic?: {
    enabled: boolean;
    volume: number;
    fadeIn: boolean;
    fadeOut: boolean;
  };
}
```

#### 2.1.2 新規コンポーネント

**VideoPreview.tsx** (新規)
```typescript
interface VideoPreviewProps {
  videoConfig: VideoConfig;
  transcript: string;
  assets: AssetItem[];
  onConfigChange: (config: VideoConfig) => void;
  onGenerate: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoConfig,
  transcript,
  assets,
  onConfigChange,
  onGenerate
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* プレビューエリア */}
      <div className="bg-gray-100 rounded-lg p-4">
        <VideoPreviewCanvas config={videoConfig} />
      </div>
      
      {/* 設定パネル */}
      <div className="space-y-4">
        <AssetSelector assets={assets} onSelect={handleAssetSelect} />
        <CaptionEditor transcript={transcript} onEdit={handleCaptionEdit} />
        <ThemeCustomizer theme={videoConfig.theme} onChange={handleThemeChange} />
      </div>
    </div>
  );
};
```

**VideoDownload.tsx** (新規)
```typescript
interface VideoDownloadProps {
  videoUrl: string;
  videoInfo: {
    format: string;
    duration: number;
    size: string;
    quality: string;
  };
  onDownload: () => void;
  onShare: (platform: 'youtube' | 'tiktok') => void;
}
```

### 2.2 ページ構成

**app/page.tsx** (メイン改修)
```typescript
'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'
import VideoSettingsForm from '@/components/VideoSettingsForm'
import VideoPreview from '@/components/VideoPreview'
import VideoDownload from '@/components/VideoDownload'
import { VideoSettings, VideoConfig, GenerationStep } from '@/types'

export default function Home() {
  const [currentStep, setCurrentStep] = useState<GenerationStep>('upload')
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null)
  const [transcript, setTranscript] = useState<string>('')
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(defaultSettings)
  const [videoConfig, setVideoConfig] = useState<VideoConfig | null>(null)
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null)
  
  const steps = [
    { id: 'upload', title: '音声アップロード', component: AudioUpload },
    { id: 'settings', title: '動画設定', component: VideoSettingsForm },
    { id: 'preview', title: 'プレビュー', component: VideoPreview },
    { id: 'download', title: 'ダウンロード', component: VideoDownload }
  ]
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ステップインジケーター */}
      <StepIndicator steps={steps} currentStep={currentStep} />
      
      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        {renderCurrentStep()}
      </main>
    </div>
  )
}
```

## 3. バックエンド設計

### 3.1 API Routes構成

#### 3.1.1 既存API (改修)

**app/api/transcribe/route.ts** (軽微改修)
- 動画生成用のタイムスタンプ情報を追加
- セグメント情報の詳細化

```typescript
interface TranscriptionResult {
  text: string;
  // 新規追加
  segments: {
    start: number;
    end: number;
    text: string;
    confidence: number;
  }[];
  language: string;
  duration: number;
}
```

#### 3.1.2 新規API

**app/api/analyze-content/route.ts** (新規)
```typescript
// コンテンツ解析API
export async function POST(request: NextRequest) {
  const { transcript, settings } = await request.json()
  
  // GPT-4でコンテンツ解析
  const analysis = await analyzeContent(transcript, settings)
  
  return NextResponse.json({
    keywords: analysis.keywords,
    topics: analysis.topics,
    mood: analysis.mood,
    suggestedAssets: analysis.suggestedAssets,
    videoStructure: analysis.videoStructure
  })
}

interface ContentAnalysis {
  keywords: string[];
  topics: string[];
  mood: 'energetic' | 'calm' | 'professional' | 'casual';
  suggestedAssets: {
    images: string[];
    videos: string[];
    colors: string[];
  };
  videoStructure: {
    intro: { start: number; end: number; };
    main: { start: number; end: number; };
    outro: { start: number; end: number; };
  };
}
```

**app/api/fetch-assets/route.ts** (新規)
```typescript
// 素材取得API
export async function POST(request: NextRequest) {
  const { keywords, assetType, count } = await request.json()
  
  // Pexels APIから素材取得
  const assets = await fetchFromPexels(keywords, assetType, count)
  
  return NextResponse.json({
    assets: assets.map(asset => ({
      id: asset.id,
      url: asset.url,
      thumbnail: asset.thumbnail,
      type: asset.type,
      duration: asset.duration,
      tags: asset.tags,
      relevanceScore: calculateRelevance(asset, keywords)
    }))
  })
}
```

**app/api/generate-video/route.ts** (新規)
```typescript
// 動画生成API
export async function POST(request: NextRequest) {
  const { 
    audioFile, 
    transcript, 
    assets, 
    settings, 
    captions 
  } = await request.json()
  
  // Remotionで動画生成
  const videoConfig = createVideoConfig({
    audioFile,
    transcript,
    assets,
    settings,
    captions
  })
  
  // 非同期で動画レンダリング開始
  const renderJob = await startVideoRender(videoConfig)
  
  return NextResponse.json({
    jobId: renderJob.id,
    status: 'rendering',
    estimatedTime: renderJob.estimatedTime
  })
}
```

**app/api/video-status/route.ts** (新規)
```typescript
// 動画生成状況確認API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  
  const status = await getVideoRenderStatus(jobId)
  
  return NextResponse.json({
    status: status.status, // 'rendering' | 'completed' | 'failed'
    progress: status.progress, // 0-100
    videoUrl: status.videoUrl,
    error: status.error
  })
}
```

### 3.2 Remotion設定

#### 3.2.1 動画コンポーネント構成

**remotion/VideoComposition.tsx**
```typescript
import { Composition } from 'remotion';
import { StandFMVideo } from './StandFMVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* YouTube横長 */}
      <Composition
        id="StandFM-YouTube"
        component={StandFMVideo}
        durationInFrames={3000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          format: 'youtube',
          aspectRatio: '16:9'
        }}
      />
      
      {/* TikTok縦長 */}
      <Composition
        id="StandFM-TikTok"
        component={StandFMVideo}
        durationInFrames={3000}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          format: 'tiktok',
          aspectRatio: '9:16'
        }}
      />
    </>
  );
};
```

**remotion/StandFMVideo.tsx**
```typescript
import { useCurrentFrame, useVideoConfig, Audio, Img, Video } from 'remotion';
import { CaptionOverlay } from './CaptionOverlay';
import { BackgroundAssets } from './BackgroundAssets';
import { BrandingOverlay } from './BrandingOverlay';

interface StandFMVideoProps {
  audioUrl: string;
  transcript: TranscriptSegment[];
  assets: AssetItem[];
  settings: VideoSettings;
  format: 'youtube' | 'tiktok';
}

export const StandFMVideo: React.FC<StandFMVideoProps> = ({
  audioUrl,
  transcript,
  assets,
  settings,
  format
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;
  
  return (
    <div style={{ width, height, position: 'relative', backgroundColor: settings.theme.backgroundColor }}>
      {/* 音声 */}
      <Audio src={audioUrl} />
      
      {/* 背景素材 */}
      <BackgroundAssets 
        assets={assets} 
        currentTime={currentTime} 
        format={format}
      />
      
      {/* キャプション */}
      <CaptionOverlay 
        transcript={transcript} 
        currentTime={currentTime}
        style={settings.captionStyle}
        format={format}
      />
      
      {/* ブランディング */}
      <BrandingOverlay 
        settings={settings}
        format={format}
      />
    </div>
  );
};
```

## 4. データモデル設計

### 4.1 型定義

**types/video.ts** (新規)
```typescript
export interface VideoSettings {
  format: 'youtube' | 'tiktok';
  aspectRatio: '16:9' | '9:16';
  duration: number;
  theme: VideoTheme;
  captionStyle: CaptionStyle;
  backgroundMusic?: BackgroundMusic;
}

export interface VideoTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  brandLogo?: string;
}

export interface CaptionStyle {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  position: 'top' | 'center' | 'bottom';
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  padding: number;
  maxWidth: number;
}

export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  duration?: number;
  tags: string[];
  relevanceScore: number;
  startTime: number;
  endTime: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker?: string;
}

export interface VideoConfig {
  id: string;
  audioUrl: string;
  transcript: TranscriptSegment[];
  assets: AssetItem[];
  settings: VideoSettings;
  metadata: {
    title: string;
    description: string;
    tags: string[];
    createdAt: Date;
  };
}

export type GenerationStep = 'upload' | 'settings' | 'preview' | 'download';

export interface RenderJob {
  id: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
  estimatedTime?: number;
  createdAt: Date;
}
```

### 4.2 状態管理

**hooks/useVideoGeneration.ts** (新規)
```typescript
import { useState, useCallback } from 'react';
import { VideoConfig, RenderJob, GenerationStep } from '@/types/video';

export const useVideoGeneration = () => {
  const [currentStep, setCurrentStep] = useState<GenerationStep>('upload');
  const [videoConfig, setVideoConfig] = useState<VideoConfig | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateVideo = useCallback(async (config: VideoConfig) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const job = await response.json();
      setRenderJob(job);
      
      // ポーリングで状況確認
      pollRenderStatus(job.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const pollRenderStatus = useCallback(async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/video-status?jobId=${jobId}`);
        const status = await response.json();
        
        setRenderJob(prev => ({ ...prev, ...status }));
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Status polling error:', err);
        clearInterval(interval);
      }
    }, 2000);
  }, []);
  
  return {
    currentStep,
    setCurrentStep,
    videoConfig,
    setVideoConfig,
    renderJob,
    isLoading,
    error,
    generateVideo
  };
};
```

## 5. セキュリティ設計

### 5.1 API セキュリティ

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // レート制限
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }
  
  // ファイルサイズ制限
  if (request.headers.get('content-length')) {
    const contentLength = parseInt(request.headers.get('content-length')!);
    if (contentLength > 25 * 1024 * 1024) { // 25MB
      return new NextResponse('File too large', { status: 413 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
};
```

### 5.2 環境変数管理

```bash
# .env.local
OPENAI_API_KEY=sk-...
PEXELS_API_KEY=...
REMOTION_APP_REGION=us-east-1
REMOTION_APP_FUNCTION_NAME=remotion-render
NEXT_PUBLIC_APP_URL=http://localhost:3000

# セキュリティ設定
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
MAX_FILE_SIZE=26214400
```

## 6. パフォーマンス設計

### 6.1 最適化戦略

1. **フロントエンド最適化**
   - React.memo でコンポーネント再レンダリング防止
   - useMemo, useCallback でパフォーマンス最適化
   - 画像の遅延読み込み

2. **API最適化**
   - 非同期処理による応答性向上
   - キャッシュ機能の実装
   - 並列処理の活用

3. **動画生成最適化**
   - Remotion Cloudでの分散処理
   - 段階的レンダリング
   - プログレッシブダウンロード

### 6.2 キャッシュ戦略

```typescript
// utils/cache.ts
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  
  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
}

export const cache = new MemoryCache();
```

## 7. エラーハンドリング設計

### 7.1 エラー分類

```typescript
// types/errors.ts
export enum ErrorCode {
  // ファイル関連
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // API関連
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  CONTENT_ANALYSIS_FAILED = 'CONTENT_ANALYSIS_FAILED',
  ASSET_FETCH_FAILED = 'ASSET_FETCH_FAILED',
  VIDEO_GENERATION_FAILED = 'VIDEO_GENERATION_FAILED',
  
  // 外部サービス関連
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  PEXELS_API_ERROR = 'PEXELS_API_ERROR',
  REMOTION_ERROR = 'REMOTION_ERROR',
  
  // システム関連
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR'
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
}
```

### 7.2 エラーハンドリング

```typescript
// utils/errorHandler.ts
export const handleApiError = (error: any): AppError => {
  if (error.code === 'ENOTFOUND') {
    return {
      code: ErrorCode.SERVER_ERROR,
      message: 'ネットワーク接続エラーが発生しました',
      details: error,
      timestamp: new Date()
    };
  }
  
  if (error.status === 429) {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'リクエスト制限に達しました。しばらく待ってから再試行してください',
      details: error,
      timestamp: new Date()
    };
  }
  
  return {
    code: ErrorCode.SERVER_ERROR,
    message: '予期しないエラーが発生しました',
    details: error,
    timestamp: new Date()
  };
};
```

## 8. テスト設計

### 8.1 テスト戦略

1. **ユニットテスト**: 個別コンポーネント・関数のテスト
2. **統合テスト**: API エンドポイントのテスト
3. **E2Eテスト**: ユーザーフローのテスト
4. **パフォーマンステスト**: 動画生成処理のテスト

### 8.2 テスト設定

```typescript
// __tests__/api/generate-video.test.ts
import { POST } from '@/app/api/generate-video/route';
import { NextRequest } from 'next/server';

describe('/api/generate-video', () => {
  it('should generate video successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-video', {
      method: 'POST',
      body: JSON.stringify({
        audioFile: 'test-audio.mp3',
        transcript: mockTranscript,
        assets: mockAssets,
        settings: mockSettings
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.jobId).toBeDefined();
    expect(data.status).toBe('rendering');
  });
});
```

## 9. デプロイ設計

### 9.1 Vercel設定

```json
// vercel.json
{
  "functions": {
    "app/api/generate-video/route.ts": {
      "maxDuration": 300
    },
    "app/api/transcribe/route.ts": {
      "maxDuration": 180
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key",
    "PEXELS_API_KEY": "@pexels-api-key",
    "REMOTION_APP_REGION": "@remotion-app-region"
  }
}
```

### 9.2 CI/CD パイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 10. 監視・ログ設計

### 10.1 ログ設計

```typescript
// utils/logger.ts
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
  userId?: string;
  requestId?: string;
}

class Logger {
  log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      requestId: this.getRequestId()
    };
    
    console.log(JSON.stringify(entry));
    
    // 本番環境では外部ログサービスに送信
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(entry);
    }
  }
  
  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }
}

export const logger = new Logger();
```

### 10.2 メトリクス監視

```typescript
// utils/metrics.ts
interface Metrics {
  videoGenerationTime: number;
  transcriptionTime: number;
  assetFetchTime: number;
  errorRate: number;
  userSatisfaction: number;
}

export const trackMetrics = (event: string, data: any): void => {
  // メトリクス収集
  if (process.env.NODE_ENV === 'production') {
    // 外部分析サービスに送信
    analytics.track(event, data);
  }
};
```

このアーキテクチャ設計により、既存のコードベースを最大限活用しながら、スケーラブルで保守性の高い動画生成アプリケーションを構築できます。