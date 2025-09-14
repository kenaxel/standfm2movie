import { NextRequest, NextResponse } from 'next/server'
import { VideoGenerationRequest, VideoGenerationResult, VideoAsset, TranscriptSegment } from '@/types'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createSupabaseServerClient } from '@/lib/supabase'

// ← Node APIs(fs/path/os)使うのでEdgeじゃなくNodeで動かす
export const runtime = 'nodejs';
// （必要なら）ビルド時に静的化されないように
export const dynamic = 'force-dynamic';

// Buffer -> ArrayBuffer 変換ユーティリティ（使用しない場合はコメントアウト）
// const bufferToArrayBuffer = (buf: Buffer): ArrayBuffer =>
//   buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

// FFmpegを使用した動画生成のためのインポート
import ffmpeg from 'fluent-ffmpeg'
import OpenAI from 'openai'
import { searchVideos } from '@/lib/pexels'
import { searchPhotos } from '@/lib/unsplash'

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
    const audioData = await fs.promises.readFile(audioPath) // Buffer
    // fetchはBuffer直渡しNG。ArrayBuffer or Blobにして送る
    const body = new Uint8Array(audioData)
    // もしくは Blob でもOK:
    // const body = new Blob([audioData], { type: 'application/octet-stream' });
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLY_AI_API_KEY,
        'content-type': 'application/octet-stream'
      },
      body
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
  audioUrl,
  segments,
  settings,
  duration
}: {
  audioUrl: string | null
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
    console.log('音声URL:', audioUrl ? `${audioUrl} (ローカルホストのため除外)` : 'なし')
    
    // タイムライン作成
    const clips: any[] = [];
    
    // 背景クリップ
    const backgroundColor = settings.backgroundColor || 'linear-gradient(135deg,#1e3a8a,#3730a3)';
    const fontSize = settings.fontSize || '42px';
    const fontFamily = settings.fontFamily || 'Arial,sans-serif';
    
    clips.push({
      asset: {
        type: 'html',
        html: `
          <div style="
            width:100%;
            height:100%;
            background:${backgroundColor};
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <div style="
              color:white;
              font-size:${fontSize};
              text-align:center;
              font-family:${fontFamily};
            ">
              ${settings.title || '音声から生成された動画'}
            </div>
          </div>
        `.replace(/\s+/g, ' ').trim()
      },
      start: 0,
      length: duration
    });

    // 音声クリップ
    if (audioUrl && audioUrl.startsWith('https://')) {
      clips.push({
        asset: {
          type: 'audio',
          src: audioUrl,
          volume: settings.audioVolume || 1,
          trim: settings.audioTrim || 0
        },
        start: 0,
        length: duration
      });
    }

    // 字幕クリップ
    const captionStyle = settings.captionStyle || {
      position: 'bottom',
      backgroundColor: 'rgba(0,0,0,0.6)',
      color: '#ffffff',
      fontSize: '24px',
      fontFamily: 'Arial',
      fontWeight: 'normal',
      padding: '0.5em',
      borderRadius: '4px'
    };

    for (const seg of segments) {
      const len = Math.max(0.6, (seg.endTime ?? seg.startTime + 1) - seg.startTime);
      clips.push({
        asset: {
          type: 'title',
          text: seg.text,
          style: 'custom',
          background: captionStyle.backgroundColor,
          color: captionStyle.color,
          size: captionStyle.fontSize,
          font: captionStyle.fontFamily,
          weight: captionStyle.fontWeight
        },
        start: seg.startTime,
        length: len,
        position: captionStyle.position,
        offset: {
          y: captionStyle.position === 'bottom' ? -60 : 
             captionStyle.position === 'top' ? 60 : 0
        },
        transition: { in: 'fade', out: 'fade' }
      });
    }
    
    const timeline = { 
      background: '#1e3a8a', 
      tracks: [{ clips }], 
    };
    
    console.log('注意: 音声はローカルホストURLのため除外されました。本番環境ではクラウドストレージを使用してください。')
    
    // Shotstackは解像度を列挙値で指定：preview|mobile|sd|hd|1080|4k
    const mapResolution = (w?: number, h?: number): 'preview'|'mobile'|'sd'|'hd'|'1080'|'4k' => {
      if (!w || !h) return 'hd';
      const key = `${w}x${h}`;
      switch (key) {
        case '3840x2160': return '4k';
        case '1920x1080': return '1080';
        case '1280x720':  return 'hd';
        case '640x480':   return 'sd';
        case '640x360':   return 'mobile';
        default:
          // 近いところに丸める
          if (w >= 3800 || h >= 2100) return '4k';
          if (w >= 1900 || h >= 1050) return '1080';
          if (w >= 1200 || h >= 700)  return 'hd';
          if (w >= 640 && h >= 360)   return 'mobile';
          return 'preview';
      }
    };

    const resEnum = mapResolution(settings?.resolution?.width, settings?.resolution?.height);

    // Shotstack の出力指定（解像度は列挙値: preview|mobile|sd|hd|1080|4k） 
    const edit = { 
      timeline, 
      output: { 
        format: 'mp4', 
        resolution: 'hd',               // ← '1280x720' ではなく列挙値を使う 
        fps: settings?.fps || 30, 
        quality: 'medium', 
      }, 
    };
    // === ここまでタイムライン作成 ===
    
    console.log('Shotstack編集データ:', JSON.stringify(edit, null, 2))
    
    // 3. レンダリングを開始
    console.log('Shotstack APIキー確認:', SHOTSTACK_API_KEY ? 'あり' : 'なし')
    console.log('Shotstack リクエストデータ:', JSON.stringify(edit, null, 2))
    
    const renderResponse = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'x-api-key': SHOTSTACK_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(edit)
    })
    
    console.log('Shotstack レスポンスステータス:', renderResponse.status)
    const responseText = await renderResponse.text()
    console.log('Shotstack レスポンス:', responseText)
    
    if (!renderResponse.ok) {
      throw new Error(`Shotstackレンダリング開始に失敗: ${renderResponse.status} - ${responseText}`)
    }
    
    const renderData = JSON.parse(responseText)
    const { response } = renderData
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
          'x-api-key': SHOTSTACK_API_KEY
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

// 受け取り: audioInput に { type: "url", url: "https://..." } も許可
type LocalAudioInput = 
  | { type: 'tempFile'; path: string }
  | { type: 'url'; url: string }    // ← 追加
  | null;

// 音声ファイルの処理関数（公開URL生成対応） 
async function processAudioFile(audioInput: LocalAudioInput, tempDir: string): Promise<{ 
  localPath: string | null 
  publicUrl: string | null 
}> { 
  if (!audioInput) return { localPath: null, publicUrl: null } 

  try { 
    // ① URL で渡ってきた場合は、そのまま使う 
    if (audioInput.type === 'url' && typeof audioInput.url === 'string') { 
      const url = audioInput.url.trim() 
      if (!/^https?:\/\//i.test(url)) { 
        throw new Error('音声URLが不正です（http/https が必要）') 
      } 
      // ここで軽く拡張子だけチェック（任意） 
      // if (!/\.(mp3|m4a|mp4|wav|ogg|webm)(\?|$)/i.test(url)) { ... } 

      return { localPath: null, publicUrl: url } 
    } 

    // ② ここから先は tempFile 等の既存処理（既存コードをそのまま） 
    let audioPath: string | null = null 
    let publicUrl: string | null = null 
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
        // 一時ディレクトリにコピー
        audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`)
        await fs.promises.copyFile(sourcePath, audioPath)
        console.log('音声ファイルをコピー:', audioPath)
        
        // 公開ディレクトリにもコピーして公開URLを生成
        const publicDir = path.join(process.cwd(), 'public', 'temp-audio')
        if (!fs.existsSync(publicDir)) {
          await fs.promises.mkdir(publicDir, { recursive: true })
        }
        
        const publicFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2)}.mp3`
        const publicFilePath = path.join(publicDir, publicFileName)
        await fs.promises.copyFile(sourcePath, publicFilePath)
        
        // 公開URLを生成
        // 環境変数名の揺れ対策（APP_URL優先、なければBASE_URL、なければVercelの自動URL）
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        publicUrl = `${baseUrl}/temp-audio/${publicFileName}`
        
        console.log('公開音声URL生成:', publicUrl)
        
        // ファイルサイズを確認
        const stats = await fs.promises.stat(audioPath)
        console.log('コピーされた音声ファイルサイズ:', stats.size, 'bytes')
        
        return { localPath: audioPath, publicUrl }
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
            
            // 公開ディレクトリにもコピー
            const publicDir = path.join(process.cwd(), 'public', 'temp-audio')
            if (!fs.existsSync(publicDir)) {
              await fs.promises.mkdir(publicDir, { recursive: true })
            }
            
            const publicFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2)}.mp3`
            const publicFilePath = path.join(publicDir, publicFileName)
            await fs.promises.copyFile(altPath, publicFilePath)
            
            const baseUrl =
              process.env.NEXT_PUBLIC_APP_URL ||
              process.env.NEXT_PUBLIC_BASE_URL ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
            publicUrl = `${baseUrl}/temp-audio/${publicFileName}`
            
            console.log('代替パスで音声ファイルをコピー:', audioPath)
            console.log('公開音声URL生成:', publicUrl)
            return { localPath: audioPath, publicUrl }
          }
        }
        
        return { localPath: null, publicUrl: null }
      }
    }
    
    return { localPath: audioPath, publicUrl }
  } catch (error) {
    console.error('音声処理エラー:', error)
    return { localPath: null, publicUrl: null }
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

    // Vercelの読み取り専用ファイルシステム対策
    const tempDir = '/tmp'
    console.log('一時ディレクトリ使用:', tempDir)
    
    let transcriptionResult: {
      transcript: string
      segments: TranscriptSegment[]
      duration: number
    }
    
    // 音声ファイルを処理（エラー処理を強化）
    let audioResult;
    try {
      audioResult = await processAudioFile(audioInput as any, tempDir)
      console.log('音声処理結果:', {
        localPath: audioResult.localPath,
        publicUrl: audioResult.publicUrl,
        exists: audioResult.localPath ? await fs.promises.access(audioResult.localPath).then(() => true).catch(() => false) : false
      })
    } catch (error) {
      console.error('音声ファイル処理中にエラー:', error)
      audioResult = { localPath: null, publicUrl: null }
    }
    
    // URL直指定の場合の検証
    let audioPublicUrl = null
    if (audioInput && (audioInput as any).type === 'url') {
      const inputUrl = (audioInput as any).url
      if (!inputUrl.startsWith('https://')) {
        console.warn('音声URLがhttpsではありません:', inputUrl)
        throw new Error('音声URLはhttpsで始まる必要があります')
      }
      audioPublicUrl = inputUrl
    } else {
      audioPublicUrl = audioResult.publicUrl
    }

    console.log('使用する音声URL:', audioPublicUrl)
     
     // Supabaseストレージへのアップロード処理（URL直指定でない場合のみ）
    const supabase = createSupabaseServerClient()
    
    // ローカルしか無い＆Supabase使えるならアップロードして公開URLにする
     if (!audioPublicUrl && audioResult.localPath && supabase) {
      try {
        const buf = await fs.promises.readFile(audioResult.localPath)
        const fileName = `audio/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
        const { error: upErr } = await supabase
          .storage
          .from('media')              // ← 事前に作ったバケット名
          .upload(fileName, buf, {
            contentType: 'audio/mpeg',
            upsert: true
          })
    
        if (upErr) {
          console.warn('Supabaseアップロード失敗:', upErr.message)
        } else {
          const { data: pub } = supabase.storage.from('media').getPublicUrl(fileName)
          audioPublicUrl = pub?.publicUrl || null
          console.log('Supabase公開URL:', audioPublicUrl)
        }
      } catch (e) {
        console.warn('Supabaseアップロード中にエラー:', e)
      }
    }
    
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
    } else if (audioResult.localPath && fs.existsSync(audioResult.localPath)) {
      // 音声ファイルがある場合はAssemblyAIで文字起こし
      console.log('AssemblyAIで文字起こし開始...')
      transcriptionResult = await transcribeWithAssemblyAI(audioResult.localPath)
      
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
    console.log('Shotstack生成開始 - パラメータ:', {
      audioUrl: audioPublicUrl,
      segmentsCount: transcriptionResult.segments.length,
      duration: transcriptionResult.duration,
      settings: JSON.stringify(settings)
    })

    let videoUrl: string;
    try {
      videoUrl = await generateVideoWithShotstack({
        audioUrl: audioPublicUrl,
        segments: transcriptionResult.segments,
        settings,
        duration: transcriptionResult.duration
      })
      
      console.log('Shotstack生成完了:', videoUrl)
    } catch (error: any) {
      console.error('Shotstack生成エラー詳細:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      })
      throw error
    }
    
    // 一時ファイルのクリーンアップ（エラー処理を強化）
    try {
      const files = await fs.promises.readdir('/tmp').catch(e => {
        console.warn('/tmpの読み取りに失敗:', e)
        return []
      })
      
      for (const file of files) {
        if (file.startsWith('audio_') || file.startsWith('video_')) {
          await fs.promises.unlink(path.join('/tmp', file)).catch(e => {
            console.warn(`ファイル ${file} の削除に失敗:`, e)
          })
        }
      }
    } catch (error) {
      console.warn('一時ファイルのクリーンアップ中にエラー:', error)
      // クリーンアップの失敗は致命的ではないので続行
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
