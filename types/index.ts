export interface AudioInput {
  type: 'url' | 'file'
  source: string | File
  duration?: number
}

export interface GenerationSettings {
  processingMode: 'natural' | 'article'
  tone: '標準' | '大阪弁' | '丁寧'
  purpose: '集客' | '教育' | '日記'
  keywords?: string
  targetAudience: string
}

export interface GeneratedContent {
  seoTitle: string
  leadText: string
  content: string
  cta: string
  metaDescription: string
  tags: string[]
  coverImageUrl: string
  markdown: string
}

export interface ApiError {
  code: 'AUDIO_TOO_LARGE' | 'INVALID_FORMAT' | 'TRANSCRIPTION_FAILED' | 'GENERATION_FAILED' | 'VIDEO_GENERATION_FAILED'
  message: string
  details?: any
}

// 動画生成用型定義
export interface VideoSettings {
  format: 'youtube' | 'tiktok'
  duration: number
  fps: number
  resolution: { width: number; height: number }
  backgroundColor: string
  fontFamily: string
  fontSize: number
  captionStyle: CaptionStyle
}

export interface CaptionStyle {
  position: 'top' | 'center' | 'bottom'
  backgroundColor: string
  color: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  outline: boolean
  padding: string
  borderRadius: string
  textShadow: string
  border: string
  highlightKeywords?: string[]
  highlightColor?: string
}

export interface VideoAsset {
  type: 'image' | 'video'
  url: string
  duration: number
  startTime: number
  endTime: number
  description?: string
}

export interface VideoGenerationResult {
  jobId?: string
  videoUrl: string
  thumbnailUrl: string
  duration: number
  format: string
  size: number
}

export interface TranscriptSegment {
  text: string
  startTime: number
  endTime: number
}

export interface VideoGenerationRequest {
  audioInput: AudioInput
  settings: VideoSettings
  transcript?: TranscriptSegment[]
  customAssets?: VideoAsset[]
}

export interface SceneAnalysis {
  scenes: {
    description: string
    keywords: string[]
    startTime: number
    endTime: number
    suggestedAssets: string[]
  }[]
}

export interface AssetSearchResult {
  id: string
  url: string
  thumbnailUrl: string
  type: 'image' | 'video'
  source: 'pexels' | 'unsplash' | 'dalle'
  description: string
  tags: string[]
  duration?: number
}

// Supabase関連の型定義
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface VideoProject {
  id: string
  user_id: string
  title: string
  description?: string
  audio_url?: string
  video_url?: string
  thumbnail_url?: string
  settings: VideoSettings
  transcript?: TranscriptSegment[]
  status: 'draft' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface UserUsage {
  id: string
  user_id: string
  videos_generated: number
  total_duration: number
  api_calls: number
  last_reset: string
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      video_projects: {
        Row: VideoProject
        Insert: Omit<VideoProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VideoProject, 'id' | 'created_at' | 'updated_at'>>
      }
      user_usage: {
        Row: UserUsage
        Insert: Omit<UserUsage, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserUsage, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}





