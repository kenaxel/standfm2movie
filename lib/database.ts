import { createSupabaseServerClient } from './supabase'
import { VideoSettings, TranscriptSegment, Database } from '@/types'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 動画プロジェクト関連のデータベース操作
 */
export class VideoProjectService {
  private supabase: SupabaseClient<Database> | null = createSupabaseServerClient()

  /**
   * 新しい動画プロジェクトを作成
   */
  async createProject(data: {
    userId: string
    title: string
    description?: string
    audioUrl?: string
    settings: VideoSettings
    transcript?: TranscriptSegment[]
  }) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      const { data: project, error } = await (this.supabase as any)
        .from('video_projects')
        .insert({
          user_id: data.userId,
          title: data.title,
          description: data.description || null,
          audio_url: data.audioUrl || null,
          settings: JSON.stringify(data.settings),
          transcript: data.transcript ? JSON.stringify(data.transcript) : null,
          status: 'draft'
        })
        .select()
        .single()

      if (error) {
        console.error('プロジェクト作成エラー:', error)
        throw new Error(`プロジェクトの作成に失敗しました: ${error.message}`)
      }

      return project
    } catch (error) {
      console.error('プロジェクト作成エラー:', error)
      throw error
    }
  }

  /**
   * プロジェクトのステータスを更新
   */
  async updateProjectStatus(
    projectId: string,
    status: 'draft' | 'processing' | 'completed' | 'failed',
    videoUrl?: string,
    thumbnailUrl?: string
  ) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      const updateData: Record<string, any> = { status }
      if (videoUrl) updateData.video_url = videoUrl
      if (thumbnailUrl) updateData.thumbnail_url = thumbnailUrl

      const { data: project, error } = await (this.supabase as any)
         .from('video_projects')
         .update(updateData)
         .eq('id', projectId)
         .select()
         .single()

      if (error) {
        console.error('プロジェクト更新エラー:', error)
        throw new Error(`プロジェクトの更新に失敗しました: ${error.message}`)
      }

      return project
    } catch (error) {
      console.error('プロジェクト更新エラー:', error)
      throw error
    }
  }

  /**
   * ユーザーのプロジェクト一覧を取得
   */
  async getUserProjects(userId: string, limit = 20) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      const { data: projects, error } = await (this.supabase as any)
         .from('video_projects')
         .select('*')
         .eq('user_id', userId)
         .order('created_at', { ascending: false })
         .limit(limit)

      if (error) {
        console.error('プロジェクト取得エラー:', error)
        throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`)
      }

      return projects || []
    } catch (error) {
      console.error('プロジェクト取得エラー:', error)
      throw error
    }
  }

  /**
   * プロジェクトを削除
   */
  async deleteProject(projectId: string): Promise<boolean> {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      const { error } = await (this.supabase as any)
         .from('video_projects')
         .delete()
         .eq('id', projectId)

      if (error) {
        console.error('プロジェクト削除エラー:', error)
        throw new Error(`プロジェクトの削除に失敗しました: ${error.message}`)
      }

      return true
    } catch (error) {
      console.error('プロジェクト削除エラー:', error)
      throw error
    }
  }
}

/**
 * ユーザー使用量関連のデータベース操作
 */
export class UserUsageService {
  private supabase: SupabaseClient<Database> | null = createSupabaseServerClient()

  /**
   * ユーザーの使用量を取得
   */
  async getUserUsage(userId: string) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      const { data: usage, error } = await (this.supabase as any)
         .from('user_usage')
         .select('*')
         .eq('user_id', userId)
         .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('使用量取得エラー:', error)
        return null
      }

      return usage
    } catch (error) {
      console.error('使用量取得エラー:', error)
      return null
    }
  }

  /**
   * 動画生成回数を増加
   */
  async incrementVideoGeneration(userId: string, duration: number) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      // 現在の使用量を取得
      const currentUsage = await this.getUserUsage(userId)
      if (!currentUsage) {
        throw new Error('ユーザー使用量が見つかりません')
      }

      const { data: usage, error } = await (this.supabase as any)
         .from('user_usage')
         .update({
           videos_generated: currentUsage.videos_generated + 1,
           total_duration: currentUsage.total_duration + duration
         })
         .eq('user_id', userId)
         .select()
         .single()

      if (error) {
        console.error('使用量更新エラー:', error)
        throw new Error(`使用量の更新に失敗しました: ${error.message}`)
      }

      return usage
    } catch (error) {
      console.error('使用量更新エラー:', error)
      throw error
    }
  }

  /**
   * API呼び出し回数を増加
   */
  async incrementApiCall(userId: string) {
    if (!this.supabase) {
      throw new Error('Supabaseクライアントが初期化されていません')
    }

    try {
      // 現在の使用量を取得
      const currentUsage = await this.getUserUsage(userId)
      if (!currentUsage) {
        throw new Error('ユーザー使用量が見つかりません')
      }

      const { data: usage, error } = await (this.supabase as any)
         .from('user_usage')
         .update({
           api_calls: currentUsage.api_calls + 1
         })
         .eq('user_id', userId)
         .select()
         .single()

      if (error) {
        console.error('API使用量更新エラー:', error)
        throw new Error(`API使用量の更新に失敗しました: ${error.message}`)
      }

      return usage
    } catch (error) {
      console.error('API使用量更新エラー:', error)
      throw error
    }
  }
}

// シングルトンインスタンス
export const videoProjectService = new VideoProjectService()
export const userUsageService = new UserUsageService()