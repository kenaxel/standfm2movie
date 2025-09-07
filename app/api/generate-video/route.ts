import { NextRequest, NextResponse } from 'next/server'
import { VideoGenerationRequest, VideoGenerationResult, TranscriptSegment } from '@/types'
import fs from 'fs'
import path from 'path'
import os from 'os'

// FFmpegを使って正確な音声長を取得
async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process')
    const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`
    
    exec(command, (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error('音声長取得エラー:', error)
        resolve(60) // デフォルト値
      } else {
        const duration = parseFloat(stdout.trim())
        console.log('実際の音声長:', duration, '秒')
        resolve(duration)
      }
    })
  })
}

// 音声ファイルの処理関数（簡素化）
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

// キーワード抽出関数
function extractKeywords(text: string): string[] {
  const stopWords = ['は', 'が', 'の', 'に', 'を', 'と', 'です', 'ます', 'した', 'から', 'など', 'これ', 'それ', 'あれ', 'で', 'も', 'や', 'て', 'に', 'が']
  const words = text.split(/[\s、。！？.,!?]/).filter(word => 
    word.length > 1 && !stopWords.includes(word) && !/^[0-9]+$/.test(word)
  )
  
  // 頻度でソート
  const wordCount: { [key: string]: number } = {}
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1
  })
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

// 改善された動画生成関数
async function generateVideoWithTimedSubtitles({
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
  console.log('タイムスタンプ付き動画生成開始')
  
  try {
    // 音声の長さを取得
    let audioDuration = settings.duration || 60
    if (audioPath && fs.existsSync(audioPath)) {
      audioDuration = await getAudioDuration(audioPath)
    }
    
    console.log('音声長:', audioDuration, '秒')
    console.log('字幕セグメント数:', transcript.length)
    
    // 字幕ファイル（SRT）を正確なタイムスタンプで生成
    const srtPath = path.join(tempDir, 'subtitles.srt')
    let srtContent = ''
    
    if (transcript && transcript.length > 0) {
      transcript.forEach((segment, index) => {
        // タイムスタンプを正確に設定
        const startTime = formatSRTTime(segment.startTime)
        const endTime = formatSRTTime(segment.endTime)
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`
        console.log(`字幕 ${index + 1}: ${startTime} --> ${endTime} | ${segment.text.trim()}`)
      })
    } else {
      srtContent = `1\n00:00:00,000 --> ${formatSRTTime(audioDuration)}\n生成された動画\n\n`
    }
    
    await fs.promises.writeFile(srtPath, srtContent, 'utf8')
    console.log('字幕ファイル生成完了:', srtPath)
    
    // 背景画像を生成（小さめのサイズ）
    const backgroundPath = path.join(tempDir, 'background.jpg')
    const { createCanvas } = require('canvas')
    const width = settings.resolution?.width || 1280  // サイズを小さく
    const height = settings.resolution?.height || 720
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    // シンプルなグラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // 軽い装飾
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const radius = Math.random() * 50 + 25
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.7 })
    await fs.promises.writeFile(backgroundPath, buffer)
    
    // FFmpegで動画生成（最適化された設定）
    return new Promise((resolve, reject) => {
      let command = `ffmpeg -y -loop 1 -i "${backgroundPath}"`
      
      // 音声ファイルがある場合は追加
      if (audioPath && fs.existsSync(audioPath)) {
        command += ` -i "${audioPath}"`
        command += ` -t ${audioDuration}`
      } else {
        command += ` -t ${audioDuration}`
      }
      
      // 字幕フィルターを追加（日本語対応、サイズ調整）
      const subtitleFilter = `subtitles='${srtPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Shadow=1,MarginV=30'`
      command += ` -vf "${subtitleFilter},scale=${width}:${height}"`
      
      // 出力設定（ファイルサイズを小さく）
      command += ` -c:v libx264 -preset medium -crf 28 -pix_fmt yuv420p`
      
      if (audioPath && fs.existsSync(audioPath)) {
        command += ` -c:a aac -b:a 96k -shortest`
      }
      
      command += ` "${outputPath}"`
      
      console.log('FFmpeg コマンド:', command)
      
      const { exec } = require('child_process')
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error('FFmpeg エラー:', error)
          console.error('stderr:', stderr)
          reject(error)
        } else {
          console.log('動画生成完了')
          console.log('stdout:', stdout)
          resolve(outputPath)
        }
      })
    })
    
  } catch (error) {
    console.error('動画生成エラー:', error)
    throw error
  }
}

// SRT時間フォーマット関数
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    console.log('新しい動画生成API開始:', new Date().toISOString())
    
    const body = await request.json() as VideoGenerationRequest
    const { audioInput, settings, transcript } = body
    
    if (!audioInput || !settings) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    // 一時ディレクトリを作成
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-gen-'))
    console.log('一時ディレクトリ作成:', tempDir)
    
    // 音声ファイルを処理
    const audioPath = await processAudioFile(audioInput, tempDir)
    console.log('音声処理完了:', audioPath)
    
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
    
    if (!processedTranscript.length && audioPath) {
      // 音声ファイルがあるが文字起こしがない場合のデフォルト
      const audioDuration = await getAudioDuration(audioPath)
      processedTranscript = [{
        text: '音声から生成された動画',
        startTime: 0,
        endTime: audioDuration
      }]
    } else if (!processedTranscript.length) {
      // 音声もなく文字起こしもない場合
      processedTranscript = [{
        text: '生成された動画',
        startTime: 0,
        endTime: settings.duration || 60
      }]
    }
    
    console.log('動画生成開始:', outputPath)
    
    // 改善された動画生成を実行
    const finalVideoPath = await generateVideoWithTimedSubtitles({
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
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`
    })
    
    // 一時ディレクトリをクリーンアップ
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      console.warn('一時ディレクトリのクリーンアップに失敗:', cleanupError)
    }
    
    const result: VideoGenerationResult = {
      videoUrl: `/output/${jobId}.mp4`,
      thumbnailUrl: 'https://via.placeholder.com/1280x720/4f46e5/ffffff?text=Generated+Video',
      duration: processedTranscript.reduce((max, segment) => Math.max(max, segment.endTime), settings.duration || 60),
      format: settings.format,
      size: fileSize,
      jobId: jobId
    }
    
    return NextResponse.json({
      success: true,
      result,
      message: '動画生成が完了しました'
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
