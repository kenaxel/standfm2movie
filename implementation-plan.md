# スタエフ音声から動画生成アプリ - 実装計画

## 1. 開発フェーズ概要

### Phase 1: 基盤構築（MVP）
- 期間: 1-2週間
- 目標: 基本的な動画生成機能の実装
- 成果物: 音声→横長動画（YouTube形式）の基本機能

### Phase 2: 機能拡張
- 期間: 1週間
- 目標: 縦長動画対応とカスタマイズ機能
- 成果物: TikTok形式対応、設定オプション追加

### Phase 3: 最適化・改善
- 期間: 1週間
- 目標: パフォーマンス最適化とUX改善
- 成果物: 本番環境対応、エラーハンドリング強化

## 2. Phase 1: 基盤構築（MVP）

### 2.1 環境セットアップ

#### タスク1: Remotion環境構築
- [ ] Remotionパッケージのインストール
  ```bash
  npm install remotion @remotion/cli @remotion/player
  npm install @remotion/bundler @remotion/renderer
  ```
- [ ] Remotion設定ファイル作成
  - `remotion.config.ts`
  - `src/remotion/` ディレクトリ構造
- [ ] 基本的なCompositionテンプレート作成

#### タスク2: 追加依存関係のインストール
- [ ] 動画処理関連パッケージ
  ```bash
  npm install fluent-ffmpeg @types/fluent-ffmpeg
  npm install canvas @types/canvas
  ```
- [ ] 外部API連携パッケージ
  ```bash
  npm install axios
  ```

#### タスク3: 環境変数設定
- [ ] `.env.local` に新しい環境変数追加
  ```
  PEXELS_API_KEY=your_pexels_api_key
  UNSPLASH_ACCESS_KEY=your_unsplash_access_key
  REMOTION_LICENSE_KEY=your_remotion_license_key
  ```

### 2.2 型定義の拡張

#### タスク4: 動画生成用型定義追加
- [ ] `types/index.ts` に動画関連インターフェース追加
  ```typescript
  // 動画設定
  interface VideoSettings {
    format: 'youtube' | 'tiktok';
    duration: number;
    fps: number;
    resolution: { width: number; height: number };
    backgroundColor: string;
    fontFamily: string;
    fontSize: number;
    captionStyle: CaptionStyle;
  }
  
  // キャプション設定
  interface CaptionStyle {
    position: 'top' | 'center' | 'bottom';
    backgroundColor: string;
    textColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    outline: boolean;
  }
  
  // 動画素材
  interface VideoAsset {
    type: 'image' | 'video';
    url: string;
    duration: number;
    startTime: number;
    endTime: number;
  }
  
  // 動画生成結果
  interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
    format: string;
    size: number;
  }
  ```

### 2.3 外部API連携の実装

#### タスク5: Pexels API連携
- [ ] `lib/pexels.ts` 作成
  ```typescript
  // 動画素材取得
  export async function searchVideos(query: string, count: number = 5)
  // 画像素材取得
  export async function searchImages(query: string, count: number = 5)
  ```

#### タスク6: Unsplash API連携
- [ ] `lib/unsplash.ts` 作成
  ```typescript
  // 高品質画像素材取得
  export async function searchPhotos(query: string, count: number = 5)
  ```

#### タスク7: OpenAI API拡張
- [ ] `lib/openai.ts` に動画用プロンプト生成機能追加
  ```typescript
  // 動画シーン分析
  export async function analyzeAudioForScenes(transcript: string)
  // 素材検索キーワード生成
  export async function generateSearchKeywords(sceneDescription: string)
  ```

### 2.4 Remotion Compositionの実装

#### タスク8: 基本Compositionテンプレート
- [ ] `src/remotion/compositions/YouTubeVideo.tsx` 作成
  - 横長（1920x1080）レイアウト
  - 音声トラック
  - 背景画像/動画
  - キャプション表示

#### タスク9: キャプションコンポーネント
- [ ] `src/remotion/components/Caption.tsx` 作成
  - SRT形式データの解析
  - タイムライン同期
  - スタイリング対応

#### タスク10: 背景メディアコンポーネント
- [ ] `src/remotion/components/BackgroundMedia.tsx` 作成
  - 画像/動画の切り替え
  - フェードイン/アウト効果
  - アスペクト比調整

### 2.5 APIエンドポイントの実装

#### タスク11: 動画生成APIエンドポイント
- [ ] `app/api/generate-video/route.ts` 作成
  ```typescript
  // POST /api/generate-video
  // 1. 音声解析とシーン分割
  // 2. 素材検索と取得
  // 3. Remotion動画生成
  // 4. 結果返却
  ```

#### タスク12: 素材検索APIエンドポイント
- [ ] `app/api/search-assets/route.ts` 作成
  ```typescript
  // POST /api/search-assets
  // キーワードベースの素材検索
  ```

#### タスク13: 動画プレビューAPIエンドポイント
- [ ] `app/api/preview-video/route.ts` 作成
  ```typescript
  // GET /api/preview-video/[id]
  // 生成された動画のプレビュー
  ```

### 2.6 フロントエンド実装

#### タスク14: 既存コンポーネントの改修
- [ ] `components/AudioUpload.tsx` 改修
  - 動画生成モード対応
  - ファイル形式バリデーション強化

#### タスク15: 動画設定コンポーネント
- [ ] `components/VideoSettings.tsx` 作成
  - フォーマット選択（YouTube/TikTok）
  - キャプションスタイル設定
  - 背景色・フォント設定

#### タスク16: 動画プレビューコンポーネント
- [ ] `components/VideoPreview.tsx` 作成
  - Remotion Player統合
  - 生成進捗表示
  - ダウンロードボタン

#### タスク17: メインページ改修
- [ ] `app/page.tsx` 改修
  - 動画生成モード追加
  - UI/UXの統合
  - 状態管理の拡張

## 3. Phase 2: 機能拡張

### 3.1 TikTok形式対応

#### タスク18: 縦長Composition実装
- [ ] `src/remotion/compositions/TikTokVideo.tsx` 作成
  - 縦長（1080x1920）レイアウト
  - モバイル最適化UI
  - 短時間動画対応

#### タスク19: レスポンシブレイアウト
- [ ] 画面サイズ別コンポーネント調整
- [ ] フォントサイズ自動調整
- [ ] キャプション位置最適化

### 3.2 カスタマイズ機能

#### タスク20: テンプレートシステム
- [ ] 動画テンプレート管理
- [ ] カスタムスタイル保存
- [ ] プリセット機能

#### タスク21: 高度な設定オプション
- [ ] アニメーション効果
- [ ] トランジション設定
- [ ] 音声エフェクト

### 3.3 バッチ処理対応

#### タスク22: 複数動画同時生成
- [ ] キュー管理システム
- [ ] 進捗追跡
- [ ] 結果一覧表示

## 4. Phase 3: 最適化・改善

### 4.1 パフォーマンス最適化

#### タスク23: 動画生成最適化
- [ ] 並列処理実装
- [ ] キャッシュ機能
- [ ] メモリ使用量最適化

#### タスク24: API最適化
- [ ] レスポンス時間改善
- [ ] エラーハンドリング強化
- [ ] レート制限対応

### 4.2 品質向上

#### タスク25: テスト実装
- [ ] ユニットテスト
- [ ] 統合テスト
- [ ] E2Eテスト

#### タスク26: エラーハンドリング
- [ ] 包括的エラー処理
- [ ] ユーザーフレンドリーなエラーメッセージ
- [ ] ログ機能強化

### 4.3 本番環境対応

#### タスク27: デプロイ設定
- [ ] Vercel設定最適化
- [ ] 環境変数管理
- [ ] CI/CDパイプライン

#### タスク28: 監視・ログ
- [ ] パフォーマンス監視
- [ ] エラー追跡
- [ ] 使用量分析

## 5. 開発優先度

### 高優先度（Phase 1必須）
1. Remotion環境構築
2. 基本的な動画生成機能
3. YouTube横長フォーマット対応
4. 音声+静止画+キャプション

### 中優先度（Phase 2目標）
1. TikTok縦長フォーマット対応
2. 動画素材統合
3. カスタマイズ機能

### 低優先度（Phase 3以降）
1. 高度なアニメーション
2. バッチ処理
3. 詳細な分析機能

## 6. リスク対策

### 技術的リスク
- **Remotion学習コスト**: 公式ドキュメント活用、サンプルプロジェクト参考
- **動画生成時間**: 非同期処理、進捗表示、タイムアウト設定
- **メモリ使用量**: ストリーミング処理、適切なクリーンアップ

### 外部依存リスク
- **API制限**: 複数プロバイダー対応、フォールバック機能
- **素材品質**: 品質フィルタリング、手動選択オプション
- **コスト管理**: 使用量監視、制限設定

## 7. 成功指標

### Phase 1成功指標
- [ ] 音声ファイルから横長動画生成成功率 > 90%
- [ ] 動画生成時間 < 5分（10分音声の場合）
- [ ] キャプション同期精度 > 95%

### Phase 2成功指標
- [ ] TikTok形式動画生成対応
- [ ] カスタマイズ機能利用率 > 50%
- [ ] ユーザー満足度 > 4.0/5.0

### Phase 3成功指標
- [ ] システム稼働率 > 99%
- [ ] エラー率 < 1%
- [ ] 平均レスポンス時間 < 3秒

## 8. 次のステップ

1. **Phase 1開始**: Remotion環境構築から着手
2. **プロトタイプ作成**: 最小限の機能で動作確認
3. **反復開発**: 機能追加とテストを繰り返し
4. **ユーザーフィードバック**: 早期段階でのフィードバック収集
5. **継続改善**: データに基づく機能改善

この実装計画に従って、段階的に開発を進めることで、効率的かつ確実にスタエフ音声から動画生成アプリを構築できます。