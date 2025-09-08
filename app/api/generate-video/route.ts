import { NextRequest, NextResponse } from 'next/server'
import { VideoGenerationRequest, VideoGenerationResult, TranscriptSegment } from '@/types'
import fs from 'fs'
import path from 'path'
import os from 'os'

// 音声ファイルの処理関数
async function processAudioFile(audioInput: any, tempDir: string): Promise<string | null> {
  if (!audioInput) return null
  
  try {
    let audioPath: string | null = null
    
    if (audioInput.type === 'tempFile' && audioInput.path) {
      // 一時ファイルの場合
      const sourcePath = path.join(process.cwd(), 'public', audioInput.path.replace('/api/audio/', 'audio/'))
      if (fs.existsSync(sourcePath)) {
        audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`)
        await fs.promises.copyFile(sourcePath, audioPath)
        console.log('音声ファイルをコピー:', audioPath)
        
        // 音声ファイルの存在と読み取り可能性を確認
        const stats = await fs.promises.stat(audioPath)
        console.log('音声ファイル情報:', {
          size: stats.size,
          path: audioPath,
          readable: fs.constants.R_OK
        })
        
        return audioPath
      } else {
        console.error('音声ファイルが見つかりません:', sourcePath)
        return null
      }
    }
    
    return audioPath
  } catch (error) {
    console.error('音声処理エラー:', error)
    return null
  }
}

// 正確な音声長を取得
async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`
    
    exec(command, (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error('音声長取得エラー:', error)
        resolve(60) // デフォルト値
      } else {
        const duration = parseFloat(stdout.trim())
        console.log('実際の音声長:', duration, '秒')
        resolve(duration || 60)
      }
    })
  })
}

// 新しい動画生成関数（音声同期を確実に）
async function generateVideoWithAudioSync({
  audioPath,
  transcript,
  settings,
  outputPath,
  tempDir
}: {
  audioPath: string | null
  transcript: TranscriptSegment[]
  settings: any
  outputPath: string
  tempDir: string
}): Promise<string> {
  console.log('音声同期動画生成開始')
  
  try {
    // 音声の長さを正確に取得
    let audioDuration = settings.duration || 60
    if (audioPath && fs.existsSync(audioPath)) {
      audioDuration = await getAudioDuration(audioPath)
      console.log('検出された音声長:', audioDuration, '秒')
    }
    
    // 背景画像を生成
    const backgroundPath = path.join(tempDir, 'background.png')
    const { createCanvas } = require('canvas')
    const width = settings.resolution?.width || 1280
    const height = settings.resolution?.height || 720
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    // シンプルな背景
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#1e3a8a')
    gradient.addColorStop(1, '#3730a3')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    const buffer = canvas.toBuffer('image/png')
    await fs.promises.writeFile(backgroundPath, buffer)
    
    // 字幕ファイル（ASS形式）を生成 - より正確なタイミング制御
    const assPath = path.join(tempDir, 'subtitles.ass')
    let assContent = `[Script Info]
Title: Generated Video
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00ffffff,&H000000ff,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
    
    if (transcript && transcript.length > 0) {
      transcript.forEach((segment, index) => {
        const startTime = formatASSTime(segment.startTime)
        const endTime = formatASSTime(segment.endTime)
        assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${segment.text.trim()}\n`
        console.log(`字幕 ${index + 1}: ${startTime} --> ${endTime} | ${segment.text.trim()}`)
      })
    } else {
      const endTime = formatASSTime(audioDuration)
      assContent += `Dialogue: 0,0:00:00.00,${endTime},Default,,0,0,0,,生成された動画\n`
    }
    
    await fs.promises.writeFile(assPath, assContent, 'utf8')
    console.log('字幕ファイル生成完了:', assPath)
    
    // FFmpegで動画生成（音声を確実に含める）
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process')
      
      let command = `ffmpeg -y`
      
      // 背景画像を入力
      command += ` -loop 1 -i "${backgroundPath}"`
      
      // 音声ファイルがある場合は入力に追加
      if (audioPath && fs.existsSync(audioPath)) {
        command += ` -i "${audioPath}"`
      }
      
      // フィルターグラフを構築
      let filterComplex = `[0:v]scale=${width}:${height}[bg];`
      
      // 字幕を追加
      filterComplex += `[bg]ass='${assPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}':fontsdir=/System/Library/Fonts[v]`
      
      command += ` -filter_complex "${filterComplex}"`
      command += ` -map "[v]"`
      
      // 音声マッピング
      if (audioPath && fs.existsSync(audioPath)) {
        command += ` -map 1:a`
        command += ` -c:a aac -b:a 128k`
      }
      
      // 動画設定
      command += ` -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p`
      command += ` -t ${audioDuration}`
      command += ` "${outputPath}"`
      
      console.log('FFmpeg コマンド:', command)
      
      exec(command, { maxBuffer: 1024 * 1024 * 20 }, (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error('FFmpeg エラー:', error)
          console.error('stderr:', stderr)
          reject(error)
        } else {
          console.log('動画生成完了')
          resolve(outputPath)
        }
      })
    })
    
  } catch (error) {
    console.error('動画生成エラー:', error)
    throw error
  }
}

// ASS時間フォーマット関数
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const centiseconds = Math.floor((seconds % 1) * 100)
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    console.log('音声同期動画生成API開始:', new Date().toISOString())
    
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
    
    // 音声ファイルを処理
    const audioPath = await processAudioFile(audioInput, tempDir)
    console.log('音声処理結果:', {
      audioPath,
      exists: audioPath ? fs.existsSync(audioPath) : false
    })
    
    // 出力ディレクトリを確保
    const outputDir = path.join(process.cwd(), 'public', 'output')
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true })
    }
    
    // ジョブIDと出力パスを生成
    const jobId = `video-${Date.now()}-${Math.random().toString(36).substring(2)}`
    const outputPath = path.join(outputDir, `${jobId}.mp4`)
    
    // 文字起こしデータを準備
    let processedTranscript: TranscriptSegment[] = transcript || []
    
    // 音声がない場合でも動画を生成
    if (!processedTranscript.length) {
      processedTranscript = [{
        text: '生成された動画',
        startTime: 0,
        endTime: settings.duration || 60
      }]
    }
    
    console.log('処理された字幕セグメント:', processedTranscript.length, '個')
    processedTranscript.forEach((segment, index) => {
      console.log(`セグメント ${index + 1}: ${segment.startTime}s-${segment.endTime}s | ${segment.text}`)
    })
    
    console.log('動画生成開始:', outputPath)
    
    // 新しい音声同期動画生成を実行
    const finalVideoPath = await generateVideoWithAudioSync({
      audioPath,
      transcript: processedTranscript,
      settings,
      outputPath,
      tempDir
    })
    
    // ファイルサイズを取得
    const stats = await fs.promises.stat(finalVideoPath)
    const fileSize = stats.size
    
    console.log('動画生成完了:', {
      path: finalVideoPath,
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      hasAudio: audioPath ? 'あり' : 'なし'
    })
    
    // 一時ディレクトリをクリーンアップ
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      console.warn('一時ディレクトリのクリーンアップに失敗:', cleanupError)
    }
    
    const result: VideoGenerationResult = {
      videoUrl: `/output/${jobId}.mp4`,
      thumbnailUrl: 'https://via.placeholder.com/1280x720/1e3a8a/ffffff?text=Generated+Video',
      duration: processedTranscript.reduce((max, segment) => Math.max(max, segment.endTime), settings.duration || 60),
      format: settings.format,
      size: fileSize,
      jobId: jobId
    }
    
    return NextResponse.json({
      success: true,
      result,
      message: '音声同期動画生成が完了しました'
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
