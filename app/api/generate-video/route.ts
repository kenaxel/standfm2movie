import { NextRequest, NextResponse } from 'next/server'
import { VideoGenerationRequest, VideoGenerationResult, TranscriptSegment } from '@/types'
import fs from 'fs'
import path from 'path'
import os from 'os'

// AssemblyAIで音声をタイムスタンプ付きで文字起こし
async function transcribeWithAssemblyAI(audioPath: string): Promise<{
  transcript: string
  segments: TranscriptSegment[]
  duration: number
}> {
  const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY
  
  if (!ASSEMBLY_AI_API_KEY) {
    throw new Error('ASSEMBLY_AI_API_KEYが設定されていません')
  }
  
  try {
    console.log('AssemblyAIで音声をアップロード中...')
    
    // 1. 音声ファイルをAssemblyAIにアップロード
    const audioData = await fs.promises.readFile(audioPath)
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLY_AI_API_KEY,
        'content-type': 'application/octet-stream'
      },
      body: audioData
    })
    
    if (!uploadResponse.ok) {
      throw new Error(`音声アップロードに失敗: ${uploadResponse.status}`)
    }
    
    const { upload_url } = await uploadResponse.json()
    console.log('音声アップロード完了:', upload_url)
    
    // 2. 文字起こしを開始
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLY_AI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: 'ja',
        punctuate: true,
        format_text: true
      })
    })
    
    if (!transcriptResponse.ok) {
      throw new Error(`文字起こし開始に失敗: ${transcriptResponse.status}`)
    }
    
    const { id } = await transcriptResponse.json()
    console.log('文字起こし開始:', id)
    
    // 3. 文字起こし完了を待機
    let result
    let attempts = 0
    const maxAttempts = 60 // 最大10分待機
    
    do {
      await new Promise(resolve => setTimeout(resolve, 10000)) // 10秒待機
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          'authorization': ASSEMBLY_AI_API_KEY
        }
      })
      
      if (!statusResponse.ok) {
        throw new Error(`ステータス取得に失敗: ${statusResponse.status}`)
      }
      
      result = await statusResponse.json()
      console.log('文字起こしステータス:', result.status)
      
      attempts++
    } while (result.status === 'processing' && attempts < maxAttempts)
    
    if (result.status !== 'completed') {
      throw new Error(`文字起こしに失敗: ${result.status}`)
    }
    
    // 4. セグメントデータを変換
    const segments: TranscriptSegment[] = result.words?.map((word: any) => ({
      text: word.text,
      startTime: word.start / 1000, // ミリ秒を秒に変換
      endTime: word.end / 1000
    })) || []
    
    return {
      transcript: result.text,
      segments,
      duration: result.audio_duration || 60
    }
    
  } catch (error) {
    console.error('AssemblyAI文字起こしエラー:', error)
    throw error
  }
}

// Shotstackで動画生成
async function generateVideoWithShotstack({
  audioPath,
  segments,
  settings,
  duration
}: {
  audioPath: string | null
  segments: TranscriptSegment[]
  settings: any
  duration: number
}): Promise<string> {
  const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY
  
  if (!SHOTSTACK_API_KEY) {
    throw new Error('SHOTSTACK_API_KEYが設定されていません')
  }
  
  try {
    console.log('Shotstackで動画生成開始...')
    
    // 1. 音声ファイルをアップロード（必要に応じて）
    let audioUrl = null
    if (audioPath && fs.existsSync(audioPath)) {
      // 実際の実装では音声ファイルをクラウドストレージにアップロード
      // ここではローカルファイルパスを使用（デモ用）
      audioUrl = audioPath
    }
    
    // 2. Shotstack編集データを構築
    const timeline = {
      soundtrack: audioUrl ? {
        src: audioUrl,
        effect: 'fadeIn'
      } : null,
      background: '#1e3a8a',
      tracks: [
        {
          clips: [
            // 背景クリップ
            {
              asset: {
                type: 'html',
                html: `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1e3a8a,#3730a3);"></div>`
              },
              start: 0,
              length: duration
            },
            // 字幕クリップ
            ...segments.map((segment, index) => ({
              asset: {
                type: 'title',
                text: segment.text,
                style: 'minimal',
                color: '#ffffff',
                size: 'medium',
                background: 'rgba(0,0,0,0.7)',
                position: 'bottom'
              },
              start: segment.startTime,
              length: segment.endTime - segment.startTime,
              transition: {
                in: 'fade',
                out: 'fade'
              }
            }))
          ]
        }
      ]
    }
    
    const edit = {
      timeline,
      output: {
        format: 'mp4',
        resolution: `${settings.resolution?.width || 1280}x${settings.resolution?.height || 720}`,
        fps: settings.fps || 30,
        quality: 'medium'
      }
    }
    
    // 3. レンダリングを開始
    const renderResponse = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${SHOTSTACK_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(edit)
    })
    
    if (!renderResponse.ok) {
      throw new Error(`Shotstackレンダリング開始に失敗: ${renderResponse.status}`)
    }
    
    const { response } = await renderResponse.json()
    const renderId = response.id
    console.log('Shotstackレンダリング開始:', renderId)
    
    // 4. レンダリング完了を待機
    let renderResult
    let attempts = 0
    const maxAttempts = 60 // 最大10分待機
    
    do {
      await new Promise(resolve => setTimeout(resolve, 10000)) // 10秒待機
      
      const statusResponse = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
        headers: {
          'authorization': `Bearer ${SHOTSTACK_API_KEY}`
        }
      })
      
      if (!statusResponse.ok) {
        throw new Error(`Shotstackステータス取得に失敗: ${statusResponse.status}`)
      }
      
      const statusData = await statusResponse.json()
      renderResult = statusData.response
      console.log('Shotstackレンダリングステータス:', renderResult.status)
      
      attempts++
    } while (renderResult.status === 'rendering' && attempts < maxAttempts)
    
    if (renderResult.status !== 'done') {
      throw new Error(`Shotstackレンダリングに失敗: ${renderResult.status}`)
    }
    
    return renderResult.url
    
  } catch (error) {
    console.error('Shotstack動画生成エラー:', error)
    throw error
  }
}

// 音声ファイルの処理関数
async function processAudioFile(audioInput: any, tempDir: string): Promise<string | null> {
  if (!audioInput) return null
  
  try {
    let audioPath: string | null = null
    
    if (audioInput.type === 'tempFile' && audioInput.path) {
      // パスの正規化 - 複数のパターンに対応
      let sourcePath: string
      
      if (audioInput.path.startsWith('/')) {
        // 絶対パスの場合
        sourcePath = audioInput.path
      } else if (audioInput.path.includes('/tmp/')) {
        // tmpディレクトリの場合
        sourcePath = audioInput.path
      } else if (audioInput.path.startsWith('/api/audio/')) {
        // API経由の場合
        sourcePath = path.join(process.cwd(), 'public', audioInput.path.replace('/api/audio/', 'audio/'))
      } else {
        // その他の場合
        sourcePath = path.join(process.cwd(), audioInput.path)
      }
      
      console.log('音声ファイル検索パス:', sourcePath)
      
      if (fs.existsSync(sourcePath)) {
        audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`)
        await fs.promises.copyFile(sourcePath, audioPath)
        console.log('音声ファイルをコピー:', audioPath)
        
        // ファイルサイズを確認
        const stats = await fs.promises.stat(audioPath)
        console.log('コピーされた音声ファイルサイズ:', stats.size, 'bytes')
        
        return audioPath
      } else {
        console.error('音声ファイルが見つかりません:', sourcePath)
        
        // 代替パスを試す
        const alternativePaths = [
          path.join(process.cwd(), 'tmp', path.basename(audioInput.path)),
          path.join(process.cwd(), 'public', 'audio', path.basename(audioInput.path)),
          audioInput.path.replace('/api/audio/', path.join(process.cwd(), 'public', 'audio/'))
        ]
        
        for (const altPath of alternativePaths) {
          console.log('代替パスを試行:', altPath)
          if (fs.existsSync(altPath)) {
            audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`)
            await fs.promises.copyFile(altPath, audioPath)
            console.log('代替パスで音声ファイルをコピー:', audioPath)
            return audioPath
          }
        }
        
        return null
      }
    }
    
    return audioPath
  } catch (error) {
    console.error('音声処理エラー:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('動画生成API開始:', new Date().toISOString())
    
    const body = await request.json() as VideoGenerationRequest
    const { audioInput, settings, transcript } = body
    
    if (!settings) {
      return NextResponse.json(
        { error: '設定が必要です' },
        { status: 400 }
      )
    }

    // 一時ディレクトリを作成
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-gen-'))
    console.log('一時ディレクトリ作成:', tempDir)
    
    let transcriptionResult: {
      transcript: string
      segments: TranscriptSegment[]
      duration: number
    }
    
    // 音声ファイルを処理
    const audioPath = await processAudioFile(audioInput, tempDir)
    console.log('音声処理結果:', {
      audioPath,
      exists: audioPath ? fs.existsSync(audioPath) : false
    })
    
    // 既存の文字起こし結果がある場合はそれを使用
    if (transcript && transcript.length > 0) {
      console.log('既存の文字起こし結果を使用:', transcript.length, '個のセグメント')
      
      // セグメントから総時間を計算
      const maxEndTime = transcript.reduce((max, segment) => Math.max(max, segment.endTime), 0)
      const duration = maxEndTime || settings.duration || 60
      
      transcriptionResult = {
        transcript: transcript.map(seg => seg.text).join(' '),
        segments: transcript,
        duration: duration
      }
    } else if (audioPath && fs.existsSync(audioPath)) {
      // 音声ファイルがある場合はAssemblyAIで文字起こし
      console.log('AssemblyAIで文字起こし開始...')
      transcriptionResult = await transcribeWithAssemblyAI(audioPath)
      
      console.log('AssemblyAI結果:', {
        transcript: transcriptionResult.transcript.substring(0, 100) + '...',
        segments: transcriptionResult.segments.length,
        duration: transcriptionResult.duration
      })
    } else {
      return NextResponse.json(
        { error: '音声ファイルまたは文字起こし結果が必要です' },
        { status: 400 }
      )
    }
    
    // 環境変数チェック - ShotstackとAssemblyAIのAPIキーがない場合はフォールバック
    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY
    const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY
    
    if (!SHOTSTACK_API_KEY || !ASSEMBLY_AI_API_KEY) {
      console.log('APIキーが設定されていないため、デモ動画を生成します')
      
      // デモ用の動画URL（実際のサービスでは実装が必要）
      const demoVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      
      const jobId = `demo-video-${Date.now()}-${Math.random().toString(36).substring(2)}`
      
      const result: VideoGenerationResult = {
        videoUrl: demoVideoUrl,
        thumbnailUrl: 'https://via.placeholder.com/1280x720/1e3a8a/ffffff?text=Demo+Video',
        duration: transcriptionResult.duration,
        format: settings.format,
        size: 0,
        jobId: jobId
      }
      
      // 一時ディレクトリをクリーンアップ
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn('一時ディレクトリのクリーンアップに失敗:', cleanupError)
      }
      
      return NextResponse.json({
        success: true,
        result,
        message: 'デモ動画を生成しました（APIキーを設定すると実際の動画が生成されます）',
        transcript: transcriptionResult.transcript,
        segments: transcriptionResult.segments.length
      })
    }
    
    // Shotstackで動画生成
    console.log('Shotstackで動画生成開始...')
    const videoUrl = await generateVideoWithShotstack({
      audioPath,
      segments: transcriptionResult.segments,
      settings,
      duration: transcriptionResult.duration
    })
    
    console.log('Shotstack動画生成完了:', videoUrl)
    
    // 一時ディレクトリをクリーンアップ
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      console.warn('一時ディレクトリのクリーンアップに失敗:', cleanupError)
    }
    
    const jobId = `video-${Date.now()}-${Math.random().toString(36).substring(2)}`
    
    const result: VideoGenerationResult = {
      videoUrl: videoUrl,
      thumbnailUrl: 'https://via.placeholder.com/1280x720/1e3a8a/ffffff?text=Generated+Video',
      duration: transcriptionResult.duration,
      format: settings.format,
      size: 0, // Shotstackからは取得できないため0
      jobId: jobId
    }
    
    return NextResponse.json({
      success: true,
      result,
      message: 'Shotstack動画生成が完了しました',
      transcript: transcriptionResult.transcript,
      segments: transcriptionResult.segments.length
    })
    
  } catch (error: any) {
    console.error('動画生成エラー:', error)
    
    return NextResponse.json(
      {
        error: `動画生成に失敗しました: ${error.message}`,
        code: 'VIDEO_GENERATION_FAILED'
      },
      { status: 500 }
    )
  }
}

// 動画生成の進行状況を取得するためのGETエンドポイント
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  
  if (!jobId) {
    return NextResponse.json(
      { error: 'ジョブIDが必要です', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
  
  // 実際の実装では、ジョブの進行状況をデータベースやキャッシュから取得
  return NextResponse.json({
    jobId,
    status: 'completed', // 'pending' | 'processing' | 'completed' | 'failed'
    progress: 100,
    message: '動画生成が完了しました'
  })
}
