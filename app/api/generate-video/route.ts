import { NextRequest, NextResponse } from 'next/server'
import { VideoGenerationRequest, VideoGenerationResult, VideoAsset, TranscriptSegment } from '@/types'
import fs from 'fs'
import path from 'path'
import os from 'os'
// FFmpegを使用した動画生成のためのインポート
import ffmpeg from 'fluent-ffmpeg'
import OpenAI from 'openai'
import { searchVideos } from '@/lib/pexels'
import { searchPhotos } from '@/lib/unsplash'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// 文字起こし結果を分析してキーワードとシーンを抽出する関数
async function analyzeTranscriptForKeywords(transcript: TranscriptSegment[]): Promise<{
  keywords: string[]
  scenes: Array<{
    startTime: number
    endTime: number
    keywords: string[]
    emotion: string
    visualConcepts: string[]
  }>
}> {
  try {
    const fullText = transcript.map(segment => segment.text).join(' ')
    
    const prompt = `以下の音声文字起こし結果を分析して、動画に適した画像・動画素材を検索するためのキーワードとシーン情報を抽出してください。

文字起こし内容:
${fullText}

以下のJSON形式で回答してください:
{
  "keywords": ["キーワード1", "キーワード2", ...],
  "scenes": [
    {
      "startTime": 0,
      "endTime": 30,
      "keywords": ["シーン固有のキーワード"],
      "emotion": "感情（happy, sad, excited, calm, serious など）",
      "visualConcepts": ["視覚的コンセプト（nature, business, technology, people など）"]
    }
  ]
}

注意:
- キーワードは英語で出力してください（画像検索API用）
- 感情は英語の単語で表現してください
- 視覚的コンセプトは具体的で検索しやすいものにしてください
- シーンは30秒程度の長さに分割してください`

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    const analysisResult = JSON.parse(response.choices[0].message.content || '{"keywords": [], "scenes": []}')
    console.log('文字起こし分析結果:', analysisResult)
    
    return analysisResult
  } catch (error) {
    console.error('文字起こし分析エラー:', error)
    // フォールバック: 基本的なキーワードを返す
    return {
      keywords: ['business', 'presentation', 'meeting'],
      scenes: [{
        startTime: 0,
        endTime: transcript.reduce((max, segment) => Math.max(max, segment.endTime), 60),
        keywords: ['business'],
        emotion: 'neutral',
        visualConcepts: ['office', 'professional']
      }]
    }
  }
}

// キーワードに基づいて画像・動画素材を検索する関数
async function searchMediaAssets(keywords: string[], scenes: any[]): Promise<VideoAsset[]> {
  try {
    const assets: VideoAsset[] = []
    
    // 各シーンに対して素材を検索
    for (const scene of scenes) {
      const sceneKeywords = [...scene.keywords, ...scene.visualConcepts]
      const searchQuery = sceneKeywords.join(' ')
      
      console.log(`シーン ${scene.startTime}-${scene.endTime}s の検索クエリ:`, searchQuery)
      
      try {
        // Pexelsから動画を検索（検索数を増やす）
        const videos = await searchVideos(searchQuery, 5)
        
        // 各動画に異なる開始時間を割り当てる
        const sceneDuration = scene.endTime - scene.startTime
        const videoDuration = sceneDuration / Math.max(videos.length, 1)
        
        videos.forEach((video, index) => {
          const videoStartTime = scene.startTime + (index * videoDuration)
          const videoEndTime = Math.min(videoStartTime + (video.duration || 5), scene.endTime)
          
          assets.push({
            type: 'video',
            url: video.url,
            duration: videoEndTime - videoStartTime,
            startTime: videoStartTime,
            endTime: videoEndTime
          })
        })
        
        // Unsplashから画像を検索（検索数を増やす）
        const images = await searchPhotos(searchQuery, 8)
        
        // 各画像に異なる開始時間を割り当てる
        const imageDuration = 3 // 各画像の表示時間を短く
        
        images.forEach((image, index) => {
          // シーン内で均等に分散
          const imageStartTime = scene.startTime + (index * (sceneDuration / Math.max(images.length, 1)))
          const imageEndTime = Math.min(imageStartTime + imageDuration, scene.endTime)
          
          if (imageStartTime < imageEndTime) {
            assets.push({
              type: 'image',
              url: image.url,
              duration: imageEndTime - imageStartTime,
              startTime: imageStartTime,
              endTime: imageEndTime
            })
          }
        })
        
      } catch (searchError) {
        console.error(`シーン ${scene.startTime}-${scene.endTime}s の検索エラー:`, searchError)
        
        // フォールバック: デフォルト画像を追加
        assets.push({
          type: 'image',
          url: 'https://via.placeholder.com/1280x720/0066cc/ffffff?text=Scene+' + Math.floor(scene.startTime),
          duration: scene.endTime - scene.startTime,
          startTime: scene.startTime,
          endTime: scene.endTime
        })
      }
    }
    
    console.log(`検索完了: ${assets.length}個の素材を取得`)
    return assets
    
  } catch (error) {
    console.error('素材検索エラー:', error)
    return []
  }
}

// 音声ファイルの長さを取得する関数
async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg')
    
    ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
      if (err) {
        console.error('FFprobe error:', err)
        reject(err)
        return
      }
      
      const duration = metadata.format.duration
      console.log('Audio duration detected:', duration, 'seconds')
      resolve(duration)
    })
  })
}

// 音声ファイルの処理関数
async function processAudioFile(audioInput: any, tempDir: string): Promise<string | null> {
  if (!audioInput) return null
  
  try {
    let audioPath: string | null = null
    
    // 文字列の場合は音声合成を行う
    if (typeof audioInput === 'string') {
      console.log('Text input detected, generating speech...')
      audioPath = path.join(tempDir, 'synthesized_audio.mp3')
      
      // OpenAI Text-to-Speech APIを使用した音声合成
      try {
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: audioInput,
        });
        
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.promises.writeFile(audioPath, buffer);
        console.log('Synthesized audio created with OpenAI TTS:', audioPath)
        return audioPath
      } catch (ttsError) {
        console.error('OpenAI TTS failed, falling back to silent audio:', ttsError)
        
        // フォールバック：無音の音声ファイルを生成
        return new Promise((resolve, reject) => {
          // テキストの長さに基づいて音声の長さを計算（1文字あたり0.1秒）
          const duration = Math.max(10, Math.min(300, audioInput.length * 0.1)) // 10秒〜300秒
          
          ffmpeg()
            .input(`sine=frequency=440:duration=${duration}`)
            .inputOptions(['-f', 'lavfi'])
            .audioCodec('mp3')
            .audioFrequency(44100)
            .audioChannels(2)
            .output(audioPath)
            .on('end', () => {
              console.log('Fallback synthesized audio created:', audioPath)
              resolve(audioPath)
            })
            .on('error', (err: Error) => {
              console.error('FFmpeg error:', err)
              resolve(null)
            })
            .run()
        })
      }
    } else if (audioInput.type === 'tempFile' && audioInput.path) {
      // 一時ファイルの場合
      const sourcePath = path.join(process.cwd(), 'public', audioInput.path.replace('/api/audio/', 'audio/'))
      if (fs.existsSync(sourcePath)) {
        audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`)
        await fs.promises.copyFile(sourcePath, audioPath)
        console.log('Temp audio file copied:', audioPath)
        return audioPath
      } else {
        console.error('Temp audio file not found:', sourcePath)
        return null
      }
    } else if (audioInput.type === 'file' && audioInput.data) {
      // Base64データから音声ファイルを保存
      const audioBuffer = Buffer.from(audioInput.data, 'base64')
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      audioPath = path.join(tempDir, `audio_${timestamp}_${randomId}.${audioInput.format || 'mp3'}`)
      await fs.promises.writeFile(audioPath, audioBuffer)
      console.log('Audio file saved with unique name:', audioPath)
    } else if (audioInput.type === 'url' && audioInput.source) {
      // URLから音声ファイルをダウンロード
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      audioPath = path.join(tempDir, `audio_${timestamp}_${randomId}.mp3`)
      console.log('Audio URL provided:', audioInput.source, 'Target file:', audioPath)
      
      try {
        let audioUrl = audioInput.source
        
        // 過去の音声ファイルのURLかどうかをチェック
        if (audioUrl.startsWith('/api/audio/') || audioUrl.includes('/api/audio/')) {
          console.log('過去の音声ファイルURLを検出:', audioUrl)
          
          // URLからファイル名を抽出
          const fileName = audioUrl.split('/').pop();
          if (!fileName) {
            throw new Error('Invalid audio file URL');
          }
          
          // 実際のファイルパスを構築
          const storedFilePath = path.join(process.cwd(), 'public', 'audio', fileName);
          
          // ファイルが存在するか確認
          if (fs.existsSync(storedFilePath)) {
            console.log('過去の音声ファイルが見つかりました:', storedFilePath);
            // ファイルを一時ディレクトリにコピー
            await fs.promises.copyFile(storedFilePath, audioPath);
            return audioPath;
          } else {
            console.log('過去の音声ファイルが見つかりません:', storedFilePath);
            // 代替URLを試す
            const alternativeUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}${audioUrl}`;
            console.log('代替URLを試みます:', alternativeUrl);
            audioUrl = alternativeUrl;
          }
        }
        
        // Stand.FMのURLの場合、実際の音声ファイルURLを取得
        if (audioUrl.includes('stand.fm')) {
          console.log('Stand.FM URL detected, extracting audio URL...')
          
          try {
            // Stand.FMのAPIエンドポイントを試す
            const episodeId = audioUrl.match(/episodes\/([a-f0-9]+)/)?.[1]
            if (episodeId) {
              console.log('Episode ID found:', episodeId)
              
              // Stand.FM APIを試す
              const apiUrl = `https://stand.fm/api/episodes/${episodeId}`
              const apiResponse = await fetch(apiUrl)
              if (apiResponse.ok) {
                const apiData = await apiResponse.json()
                if (apiData.audio_url) {
                  audioUrl = apiData.audio_url
                  console.log('Audio URL from API:', audioUrl)
                } else if (apiData.episode && apiData.episode.audio_url) {
                  audioUrl = apiData.episode.audio_url
                  console.log('Audio URL from episode data:', audioUrl)
                }
              }
            }
            
            // APIで取得できない場合はHTMLページから抽出
            if (audioUrl.includes('stand.fm')) {
              const pageResponse = await fetch(audioUrl)
              const pageHtml = await pageResponse.text()
              
              // 複数のパターンを試す
              const patterns = [
                /"audio_url"\s*:\s*"([^"]+)"/,
                /"audioUrl"\s*:\s*"([^"]+)"/,
                /"src"\s*:\s*"([^"]*\.mp3[^"]*)"/,
                /https:\/\/[^"\s]*\.mp3/g,
                /https:\/\/[^"\s]*audio[^"\s]*\.(mp3|m4a)/g,
                /__NEXT_DATA__[^<]*"audio_url":"([^"]+)"/,
                /window\.__INITIAL_STATE__[^<]*"audio_url":"([^"]+)"/
              ]
              
              for (const pattern of patterns) {
                const match = pageHtml.match(pattern)
                if (match && match[1]) {
                  audioUrl = match[1]
                  console.log('Audio URL extracted with pattern:', audioUrl)
                  break
                } else if (match && match[0] && match[0].includes('.mp3')) {
                  audioUrl = match[0]
                  console.log('Direct MP3 URL found:', audioUrl)
                  break
                }
              }
              
              // 元のStand.FMページURLと同じかチェック（音声URLが抽出できていない場合）
              if (audioUrl === audioInput.source) {
                console.log('Could not extract audio URL from Stand.FM page')
                console.log('Page HTML length:', pageHtml.length)
                // HTMLの一部をログ出力（デバッグ用）
                const htmlSnippet = pageHtml.substring(0, 1000)
                console.log('HTML snippet:', htmlSnippet)
                return null
              }
            }
          } catch (extractError) {
            console.error('Error extracting Stand.FM audio URL:', extractError)
            return null
          }
        }
        
        // キャッシュを回避するためのパラメータを追加
        if (!audioUrl.includes('?')) {
          audioUrl = `${audioUrl}?t=${Date.now()}`;
        } else {
          audioUrl = `${audioUrl}&t=${Date.now()}`;
        }
        
        const response = await fetch(audioUrl)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const audioBuffer = await response.arrayBuffer()
        await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer))
        console.log('Audio downloaded and saved:', audioPath)
      } catch (downloadError) {
        console.error('Failed to download audio from URL:', downloadError)
        // URLダウンロードに失敗した場合は、音声なしで続行
        return null
      }
    }
    
    return audioPath
  } catch (error) {
    console.error('Audio processing error:', error)
    return null
  }
}

// 素材をタイムラインに配置する関数
async function arrangeAssetsOnTimeline(assets: VideoAsset[], totalDuration: number): Promise<{
  timeline: Array<{
    asset: VideoAsset
    startTime: number
    endTime: number
    transitionType: 'fade' | 'slide' | 'zoom'
  }>
  overlayAssets: VideoAsset[]
}> {
  try {
    const timeline: Array<{
      asset: VideoAsset
      startTime: number
      endTime: number
      transitionType: 'fade' | 'slide' | 'zoom'
    }> = []
    
    const overlayAssets: VideoAsset[] = []
    
    // 素材を時間順にソート
    const sortedAssets = assets.sort((a, b) => a.startTime - b.startTime)
    
    let currentTime = 0
    
    for (const asset of sortedAssets) {
      // 素材の配置時間を調整
      const startTime = Math.max(currentTime, asset.startTime)
      const duration = Math.min(asset.duration, asset.endTime - asset.startTime)
      const endTime = startTime + duration
      
      // タイムラインに追加
      timeline.push({
        asset,
        startTime,
        endTime,
        transitionType: getTransitionType(asset.type)
      })
      
      currentTime = endTime
      
      // 総時間を超えないようにチェック
      if (currentTime >= totalDuration) {
        break
      }
    }
    
    // 時間の隙間を埋めるためのフィラー素材を追加
    const filledTimeline = await fillTimelineGaps(timeline, totalDuration)
    
    console.log(`タイムライン配置完了: ${filledTimeline.length}個の素材を配置`)
    
    return {
      timeline: filledTimeline,
      overlayAssets
    }
    
  } catch (error) {
    console.error('タイムライン配置エラー:', error)
    return { timeline: [], overlayAssets: [] }
  }
}

// トランジションタイプを決定する関数
function getTransitionType(assetType: 'image' | 'video'): 'fade' | 'slide' | 'zoom' {
  const transitions: Array<'fade' | 'slide' | 'zoom'> = ['fade', 'slide', 'zoom']
  return transitions[Math.floor(Math.random() * transitions.length)]
}

// タイムラインの隙間を埋める関数
async function fillTimelineGaps(timeline: any[], totalDuration: number): Promise<any[]> {
  const filledTimeline = [...timeline]
  
  // 最初の素材の前に隙間がある場合
  if (timeline.length > 0 && timeline[0].startTime > 0) {
    filledTimeline.unshift({
      asset: {
        type: 'image',
        url: 'https://via.placeholder.com/1920x1080/4f46e5/ffffff?text=Opening',
        duration: timeline[0].startTime,
        startTime: 0,
        endTime: timeline[0].startTime
      },
      startTime: 0,
      endTime: timeline[0].startTime,
      transitionType: 'fade'
    })
  }
  
  // 素材間の隙間を埋める
  for (let i = 0; i < timeline.length - 1; i++) {
    const currentEnd = timeline[i].endTime
    const nextStart = timeline[i + 1].startTime
    
    if (nextStart > currentEnd) {
      const gapDuration = nextStart - currentEnd
      filledTimeline.splice(i + 1, 0, {
        asset: {
          type: 'image',
          url: `https://via.placeholder.com/1920x1080/6366f1/ffffff?text=Transition+${i + 1}`,
          duration: gapDuration,
          startTime: currentEnd,
          endTime: nextStart
        },
        startTime: currentEnd,
        endTime: nextStart,
        transitionType: 'fade'
      })
    }
  }
  
  // 最後の素材の後に隙間がある場合
  const lastAsset = timeline[timeline.length - 1]
  if (lastAsset && lastAsset.endTime < totalDuration) {
    filledTimeline.push({
      asset: {
        type: 'image',
        url: 'https://via.placeholder.com/1920x1080/8b5cf6/ffffff?text=Ending',
        duration: totalDuration - lastAsset.endTime,
        startTime: lastAsset.endTime,
        endTime: totalDuration
      },
      startTime: lastAsset.endTime,
      endTime: totalDuration,
      transitionType: 'fade'
    })
  }
  
  return filledTimeline
}

// タイムラインベースの動画生成関数
async function generateTimelineBasedVideo({
  timeline,
  audioPath,
  outputPath,
  settings,
  tempDir
}: {
  timeline: any[]
  audioPath: string | null
  outputPath: string
  settings: any
  tempDir: string
}): Promise<string> {
  try {
    console.log(`タイムライン動画生成: ${timeline.length}個のセグメント`)
    
    // タイムラインを時間順にソート
    const sortedTimeline = [...timeline].sort((a, b) => a.startTime - b.startTime);
    
    // 重複するセグメントを削除（同じ時間帯に複数のセグメントがある場合）
    const uniqueTimeline: any[] = [];
    let lastEndTime = 0;
    
    for (const segment of sortedTimeline) {
      // 前のセグメントと重複しない部分だけを使用
      if (segment.startTime >= lastEndTime) {
        uniqueTimeline.push(segment);
        lastEndTime = segment.endTime;
      } else if (segment.endTime > lastEndTime) {
        // 部分的に重複する場合は、重複しない部分だけを使用
        const adjustedSegment = {
          ...segment,
          startTime: lastEndTime,
        };
        uniqueTimeline.push(adjustedSegment);
        lastEndTime = segment.endTime;
      }
      // 完全に重複する場合はスキップ
    }
    
    console.log(`重複除去後のタイムライン: ${uniqueTimeline.length}個のセグメント`);
    
    // 各セグメント用の動画ファイルを生成
    const segmentPaths: string[] = []
    
    for (let i = 0; i < uniqueTimeline.length; i++) {
      const segment = uniqueTimeline[i]
      const segmentPath = path.join(tempDir, `segment_${i}.mp4`)
      
      console.log(`セグメント ${i + 1}/${uniqueTimeline.length} 生成中:`, segment.asset.url)
      
      // セグメント動画を生成
      await generateSegmentVideo({
        asset: segment.asset,
        startTime: segment.startTime,
        endTime: segment.endTime,
        transitionType: segment.transitionType,
        outputPath: segmentPath,
        settings,
        tempDir
      })
      
      segmentPaths.push(segmentPath)
    }
    
    // セグメントを結合
    console.log('セグメント結合開始')
    await concatenateSegments(segmentPaths, outputPath, audioPath, settings)
    
    console.log('タイムライン動画生成完了')
    return outputPath
    
  } catch (error) {
    console.error('タイムライン動画生成エラー:', error)
    throw error
  }
}

// 個別セグメント動画生成関数
async function generateSegmentVideo({
  asset,
  startTime,
  endTime,
  transitionType,
  outputPath,
  settings,
  tempDir
}: {
  asset: VideoAsset
  startTime: number
  endTime: number
  transitionType: string
  outputPath: string
  settings: any
  tempDir: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime
    
    let ffmpegCommand = ffmpeg()
    
    if (asset.type === 'image') {
      // 画像の場合
      ffmpegCommand
        .input(asset.url)
        .inputOptions(['-loop 1', '-t', duration.toString()])
        .videoFilters([
          `scale=${settings.resolution?.width || 1920}:${settings.resolution?.height || 1080}:force_original_aspect_ratio=decrease`,
          `pad=${settings.resolution?.width || 1920}:${settings.resolution?.height || 1080}:(ow-iw)/2:(oh-ih)/2`,
          getTransitionFilter(transitionType, duration)
        ])
    } else {
      // 動画の場合
      ffmpegCommand
        .input(asset.url)
        .inputOptions(['-t', duration.toString()])
        .videoFilters([
          `scale=${settings.resolution?.width || 1920}:${settings.resolution?.height || 1080}:force_original_aspect_ratio=decrease`,
          `pad=${settings.resolution?.width || 1920}:${settings.resolution?.height || 1080}:(ow-iw)/2:(oh-ih)/2`,
          getTransitionFilter(transitionType, duration)
        ])
    }
    
    ffmpegCommand
      .videoCodec('libx264')
      .fps(settings.fps || 30)
      .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 28'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

// トランジションフィルターを取得する関数
function getTransitionFilter(transitionType: string, duration: number): string {
  switch (transitionType) {
    case 'fade':
      return `fade=in:0:30,fade=out:${Math.max(0, duration * 30 - 30)}:30`
    case 'slide':
      return `slide=direction=right:duration=1`
    case 'zoom':
      return `zoompan=z='1+0.002*on':d=1`
    default:
      return `fade=in:0:15,fade=out:${Math.max(0, duration * 30 - 15)}:15`
  }
}

// セグメント結合関数
async function concatenateSegments(
  segmentPaths: string[],
  outputPath: string,
  audioPath: string | null,
  settings: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegCommand = ffmpeg()
    
    // 各セグメントを入力として追加
    segmentPaths.forEach(segmentPath => {
      ffmpegCommand.input(segmentPath)
    })
    
    // 音声ファイルがある場合は追加
    if (audioPath && fs.existsSync(audioPath)) {
      ffmpegCommand.input(audioPath)
    }
    
    // フィルターグラフを構築
    const filterComplex = segmentPaths.map((_, index) => `[${index}:v]`).join('') + `concat=n=${segmentPaths.length}:v=1:a=0[outv]`
    
    ffmpegCommand
      .complexFilter(filterComplex)
      .outputOptions(['-map [outv]'])
    
    // 音声マッピング
    if (audioPath && fs.existsSync(audioPath)) {
      ffmpegCommand.outputOptions([`-map ${segmentPaths.length}:a`, '-shortest'])
    }
    
    ffmpegCommand
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 28'])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('結合コマンド:', commandLine)
      })
      .on('progress', (progress) => {
        console.log('結合進行状況:', progress.percent + '%')
      })
      .on('end', () => {
        console.log('セグメント結合完了')
        resolve()
      })
      .on('error', (err) => {
        console.error('結合エラー:', err)
        reject(err)
      })
      .run()
  })
}

// 音声の文字起こし関数（タイムスタンプ付き）
async function transcribeAudioWithTimestamps(audioPath: string): Promise<TranscriptSegment[]> {
  try {
    console.log('OpenAI Whisper APIで文字起こし開始:', audioPath)
    
    // OpenAI SDKを使用して文字起こし
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    })
    
    console.log('Whisper API結果:', transcription)
    
    // セグメントデータを変換
    const segments: TranscriptSegment[] = []
    if (transcription.segments && Array.isArray(transcription.segments)) {
      for (const segment of transcription.segments) {
        // セグメントのテキストが空でない場合のみ追加
        const trimmedText = segment.text.trim()
        if (trimmedText) {
          segments.push({
            text: trimmedText,
            startTime: segment.start,
            endTime: segment.end
          })
        }
      }
    } else if (transcription.text) {
      // セグメント情報がない場合は文を分割して複数のセグメントを作成
      const text = transcription.text.trim();
      
      // 日本語の場合は句読点で分割
      const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
      let sentences = [];
      
      if (isJapanese) {
        sentences = text.split(/[。.!?！？]/).filter(s => s.trim());
      } else {
        // 英語の場合はピリオドなどで分割
        sentences = text.split(/[.!?]/).filter(s => s.trim());
      }
      
      // 音声の長さを推定（デフォルト60秒）
      let audioDuration = 60;
      try {
        audioDuration = await getAudioDuration(audioPath);
      } catch (err) {
        console.log('音声長の取得に失敗、デフォルト値を使用:', err);
      }
      
      // 各文に均等に時間を割り当て
      const segmentDuration = audioDuration / Math.max(sentences.length, 1);
      
      sentences.forEach((sentence, index) => {
        if (sentence.trim()) {
          segments.push({
            text: sentence.trim(),
            startTime: index * segmentDuration,
            endTime: (index + 1) * segmentDuration
          });
        }
      });
    }
    
    console.log('文字起こし完了:', segments.length, '個のセグメント')
    return segments
    
  } catch (error) {
    console.error('文字起こしエラー:', error)
    // エラーの場合は空の配列を返す
    return []
  }
}

// 音声を字幕として表示する動画生成関数
async function generateSubtitleVideo({
  audioPath,
  audioInput,
  transcript,
  settings,
  tempDir,
  timeline,
  audioDuration,
  outputPath
}: {
  audioPath: string
  audioInput: string
  transcript: TranscriptSegment[]
  settings: any
  tempDir: string
  timeline?: any
  audioDuration: number
  outputPath?: string
}): Promise<string> {
  // 出力パスが指定されていない場合は一時ディレクトリを使用
  const finalOutputPath = outputPath || path.join(tempDir, `output_${Date.now()}.mp4`)
  
  console.log('Generating video with audio and subtitles')
  
  try {
    // 字幕ファイル（SRT形式）を生成
    const timestamp = Date.now()
    const subtitlePath = path.join(tempDir, `subtitles_${timestamp}.srt`)
    let srtContent = ''
    
    console.log('字幕生成 - transcript:', transcript ? transcript.length : 'null', '個のセグメント')
    console.log('transcript詳細:', transcript)
    if (transcript && transcript.length > 0) {
      // 文字起こしデータから字幕を生成
      console.log('transcriptから字幕を生成:', transcript)
      
      // 字幕の重複を避けるため、短すぎるセグメントを結合
      const minSegmentDuration = 1.0; // 最小セグメント長（秒）
      const processedTranscript: TranscriptSegment[] = [];
      
      // 字幕のタイミングを調整するための処理
      // 1. まず全体の時間を確認
      const totalTranscriptDuration = transcript.reduce((max, segment) => 
        Math.max(max, segment.endTime), 0);
      
      // 2. 音声の長さと文字起こしの長さが大きく異なる場合は調整
      const scaleFactor = totalTranscriptDuration > 0 ? 
        audioDuration / totalTranscriptDuration : 1;
      
      // 3. スケーリングされたトランスクリプトを作成
      const scaledTranscript = transcript.map(segment => ({
        ...segment,
        startTime: segment.startTime * scaleFactor,
        endTime: segment.endTime * scaleFactor
      }));
      
      let currentSegment: TranscriptSegment | null = null;
      
      scaledTranscript.forEach((segment, index) => {
        // セグメントの長さを計算
        const segmentDuration = segment.endTime - segment.startTime;
        
        if (!currentSegment) {
          currentSegment = { ...segment };
        } else if (segmentDuration < minSegmentDuration || 
                  (segment.startTime - currentSegment.endTime) < 0.3) {
          // セグメントが短すぎる、または前のセグメントとの間隔が短すぎる場合は結合
          currentSegment.text += ' ' + segment.text;
          currentSegment.endTime = segment.endTime;
        } else {
          // 十分な長さのセグメントは追加して新しいセグメントを開始
          processedTranscript.push(currentSegment);
          currentSegment = { ...segment };
        }
        
        // 最後のセグメントの処理
        if (index === scaledTranscript.length - 1 && currentSegment) {
          processedTranscript.push(currentSegment);
        }
      });
      
      // 処理済みのセグメントからSRTを生成
      processedTranscript.forEach((segment, index) => {
        const startTime = formatSRTTime(segment.startTime)
        const endTime = formatSRTTime(segment.endTime)
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`
        console.log(`字幕セグメント ${index + 1}: ${startTime} --> ${endTime} | ${segment.text}`)
      })
    } else {
      // 音声入力テキストを全体の字幕として使用
      console.log('transcriptが空のため、audioInputから字幕を生成')
      const text = typeof audioInput === 'string' ? audioInput : (audioInput as any).source
      
      // 日本語の場合は文字単位、英語の場合は単語単位で分割
      const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
      console.log('テキスト言語判定:', isJapanese ? '日本語' : '英語');
      
      if (isJapanese) {
        // 日本語テキストの場合：句読点で分割
        const sentences = text.split(/[。！？]/).filter((s: string) => s.trim());
        const segmentCount = Math.min(sentences.length, 30); // 最大30セグメント
        const segmentDuration = audioDuration / Math.max(segmentCount, 1);
        
        sentences.forEach((sentence: string, index: number) => {
          if (index < 30 && sentence.trim()) { // 最大30セグメントまで
            const startTime = index * segmentDuration;
            const endTime = (index + 1) * segmentDuration;
            srtContent += `${index + 1}\n${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n${sentence.trim()}\n\n`;
          }
        });
      } else {
        // 英語テキストの場合：単語で分割
        const words = text.split(' ');
        const wordsPerSegment = Math.ceil(words.length / 20);
        const segmentDuration = audioDuration / 20;
        
        for (let i = 0; i < 20; i++) {
          const startTime = i * segmentDuration;
          const endTime = (i + 1) * segmentDuration;
          const segmentWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
          const segmentText = segmentWords.join(' ');
          
          if (segmentText.trim()) {
            srtContent += `${i + 1}\n${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n${segmentText}\n\n`;
          }
        }
      }
    }
    
    await fs.promises.writeFile(subtitlePath, srtContent, 'utf-8')
    console.log('Subtitle file created:', subtitlePath)
    
    // 背景画像を生成
    const { createCanvas } = require('canvas')
    const canvas = createCanvas(settings.resolution?.width || 1920, settings.resolution?.height || 1080)
    const ctx = canvas.getContext('2d')
    
    // シンプルな背景（グラデーション）
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#2c3e50')
    gradient.addColorStop(1, '#34495e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 背景素材の準備
    let backgroundInput = ''
    let inputOptions: string[] = []
    
    if (timeline && timeline.timeline && timeline.timeline.length > 0) {
      // 動画素材がある場合は最初の動画を使用
      const firstVideoAsset = timeline.timeline.find((item: any) => item.asset && item.asset.url)
      if (firstVideoAsset && firstVideoAsset.asset.url) {
        backgroundInput = firstVideoAsset.asset.url
        console.log('Using video asset as background:', backgroundInput)
      } else {
        // 動画素材がない場合は静止画像を作成
        const backgroundPath = path.join(tempDir, 'background.png')
        const buffer = canvas.toBuffer('image/png')
        await fs.promises.writeFile(backgroundPath, buffer)
        backgroundInput = backgroundPath
        inputOptions = ['-loop 1']
        console.log('Background image created:', backgroundPath)
      }
    } else {
      // timelineがない場合は静止画像を作成
      const backgroundPath = path.join(tempDir, 'background.png')
      const buffer = canvas.toBuffer('image/png')
      await fs.promises.writeFile(backgroundPath, buffer)
      backgroundInput = backgroundPath
      inputOptions = ['-loop 1']
      console.log('Background image created:', backgroundPath)
    }
    
    // FFmpegで動画生成（音声 + 背景 + 字幕）
    return new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg()
        .input(backgroundInput)
      
      if (inputOptions.length > 0) {
        ffmpegCommand.inputOptions(inputOptions)
      }
      
      // 音声ファイルを追加
      if (audioPath && fs.existsSync(audioPath)) {
        console.log('Adding audio track:', audioPath)
        ffmpegCommand.input(audioPath)
      }
      
      // 字幕フィルターを追加（force_styleを削除してSRTの時間情報を尊重）
      const subtitleFilter = `subtitles=${subtitlePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}`
      
      // 動画素材を使用する場合とそうでない場合でフィルターを分ける
      const videoFilters = [`scale=${settings.resolution?.width || 1920}:${settings.resolution?.height || 1080}`]
      
      // 静止画像の場合のみ動的効果を追加
      if (inputOptions.includes('-loop 1')) {
        videoFilters.push(
          // 動的な視覚効果を追加
          'zoompan=z=\'1+0.0005*on\':d=1:s=1920x1080',
          // 色相の微妙な変化
          'hue=h=sin(2*PI*t/15)*20',
          // フェードイン効果
          'fade=in:0:30'
        )
      }
      
      // 字幕フィルターは常に追加
      videoFilters.push(subtitleFilter)
      
      ffmpegCommand.videoFilters(videoFilters)
        .videoCodec('libx264')
        .fps(settings.fps || 30)
        .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 28'])
      
      // 音声がある場合は音声を統合
      if (audioPath && fs.existsSync(audioPath)) {
        console.log('Integrating audio with video')
        ffmpegCommand
          .audioCodec('aac')
          .audioBitrate('128k')
          .outputOptions(['-t', audioDuration.toString()])
      } else {
        console.log('No audio file, creating silent video')
        ffmpegCommand.outputOptions(['-t', audioDuration.toString()])
      }
      
      ffmpegCommand
        .output(finalOutputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine)
          console.log('出力先:', finalOutputPath)
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done')
        })
        .on('end', () => {
          console.log('Subtitle video generation completed at:', finalOutputPath)
          // ファイルの存在を確認
          if (fs.existsSync(finalOutputPath)) {
            const stats = fs.statSync(finalOutputPath)
            console.log('生成された動画ファイル:', {
              path: finalOutputPath,
              size: stats.size,
              sizeInMB: (stats.size / 1024 / 1024).toFixed(2) + ' MB'
            })
          } else {
            console.error('動画ファイルが生成されませんでした:', finalOutputPath)
          }
          resolve(finalOutputPath)
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err)
          reject(err)
        })
        .run()
    })
  } catch (error) {
    console.error('Subtitle video generation error:', error)
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

// 動的な動画生成関数
async function generateSimpleVideo({
  audioInput,
  settings,
  outputPath,
  tempDir,
  timeline
}: {
  audioInput: any
  settings: any
  outputPath: string
  tempDir: string
  timeline?: any[]
}) {
  console.log('Generating animated video with Canvas and FFmpeg')
  
  try {
    // 音声ファイルを処理
    const audioPath = await processAudioFile(audioInput, tempDir)
    console.log('Subtitle video - Processed audio path:', audioPath)
    
    // 音声ファイルの存在確認
    if (audioPath && fs.existsSync(audioPath)) {
      const stats = await fs.promises.stat(audioPath)
      console.log('Subtitle video - Audio file size:', stats.size, 'bytes')
    } else {
      console.log('Subtitle video - No audio file available or file does not exist')
     }
    
    // Canvas で魅力的な背景画像を生成
    const { createCanvas } = require('canvas')
    const canvas = createCanvas(settings.resolution?.width || 1920, settings.resolution?.height || 1080)
    const ctx = canvas.getContext('2d')
    
    // 動的な背景のグラデーション
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#ff6b6b')
    gradient.addColorStop(0.3, '#4ecdc4')
    gradient.addColorStop(0.6, '#45b7d1')
    gradient.addColorStop(1, '#96ceb4')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 音声波形風の装飾
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 4
    for (let i = 0; i < 30; i++) {
      const x = (canvas.width / 30) * i + 30
      const baseHeight = canvas.height * 0.7
      const waveHeight = Math.sin(i * 0.3) * 60 + 80
      
      ctx.beginPath()
      ctx.moveTo(x, baseHeight)
      ctx.lineTo(x, baseHeight - waveHeight)
      ctx.stroke()
    }
    
    // メインタイトル
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 10
    ctx.fillStyle = 'white'
    ctx.font = 'bold 64px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('音声から動画生成', canvas.width / 2, canvas.height / 2 - 50)
    
    // 音声トラック情報
    ctx.shadowBlur = 0
    if (audioPath) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.8)'
      ctx.font = '32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('🎵 音声トラック付き', canvas.width / 2, canvas.height / 2 + 50)
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)'
      ctx.font = '24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('音声なし', canvas.width / 2, canvas.height / 2 + 50)
    }
    
    // 生成時刻
    const now = new Date()
    ctx.fillStyle = 'rgba(226, 232, 240, 0.6)'
    ctx.font = '20px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`生成時刻: ${now.toLocaleString('ja-JP')}`, canvas.width - 50, 50)
    
    // 静止画を保存
    const imagePath = path.join(tempDir, 'background.png')
    const buffer = canvas.toBuffer('image/png')
    await fs.promises.writeFile(imagePath, buffer)
    
    console.log('Background image created:', imagePath)
    
    // タイムラインベースの動画生成
    if (timeline && timeline.length > 0) {
      console.log('タイムラインベースの動画生成開始')
      return await generateTimelineBasedVideo({
        timeline,
        audioPath,
        outputPath,
        settings,
        tempDir
      })
    }
    
    // フォールバック: 静止画ベースの動画生成
    return new Promise((resolve, reject) => {
      const ffmpegCommand = ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1', '-t', (settings.duration || 60).toString()])
        .videoCodec('libx264')
        .fps(settings.fps || 30)
        .videoFilters([
          // ゆっくりとしたズームイン効果
          'zoompan=z=\'1+0.001*on\':d=1:s=1920x1080',
          // 色相の微妙な変化
          'hue=h=sin(2*PI*t/10)*30',
          // フェードイン効果
          'fade=in:0:30'
        ])
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset fast',
          '-crf 28'
        ])
      
      // 音声ファイルがある場合は追加
      if (audioPath && fs.existsSync(audioPath)) {
        console.log('Adding audio track:', audioPath)
        ffmpegCommand
          .input(audioPath)
          .audioCodec('aac')
          .outputOptions([
            '-map 0:v:0',  // 最初の入力の動画ストリーム
            '-map 1:a:0',  // 二番目の入力の音声ストリーム
            '-shortest'    // 短い方の長さに合わせる
          ])
      } else {
        console.log('No audio track provided, generating silent video')
      }
      
      ffmpegCommand
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done')
        })
        .on('end', () => {
          console.log('Video generation completed successfully')
          resolve(outputPath)
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err)
          reject(err)
        })
        .run()
    })
  } catch (error) {
    console.error('Canvas error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('動画生成API開始:', new Date().toISOString())
    
    const body = await request.json() as VideoGenerationRequest
    console.log('リクエストボディ受信:', JSON.stringify(body, null, 2))
    const { audioInput, settings, transcript, customAssets } = body
    
    if (!audioInput || !settings) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    // 1. 古い一時ディレクトリのクリーンアップ（1時間以上古いもの）
    try {
      const tmpDir = os.tmpdir()
      const allDirs = await fs.promises.readdir(tmpDir)
      const videoDirs = allDirs.filter(dir => dir.startsWith('video-generation-'))
      
      for (const dir of videoDirs) {
        const dirPath = path.join(tmpDir, dir)
        try {
          const stats = await fs.promises.stat(dirPath)
          const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
          
          if (ageInHours > 1) { // 1時間以上古い
            await fs.promises.rm(dirPath, { recursive: true, force: true })
            console.log('Cleaned up old directory:', dirPath)
          }
        } catch (error) {
          console.log('Failed to clean up directory:', dirPath, error)
        }
      }
    } catch (error) {
      console.log('Directory cleanup failed:', error)
    }

    // 2. 音声ファイルの処理
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-generation-'))
    console.log('Temporary directory created:', tempDir)
    
    const audioPath = await processAudioFile(audioInput, tempDir)
    console.log('Audio processing completed:', audioPath)
    
    // 実際の音声ファイルの長さを取得
    let audioDuration: number = settings.duration // デフォルト値
    if (audioPath) {
      try {
        audioDuration = await getAudioDuration(audioPath)
        console.log('Using actual audio duration:', audioDuration, 'seconds')
      } catch (error) {
        console.error('Failed to get audio duration, using default:', settings.duration)
        audioDuration = settings.duration
      }
    }

    // 2. 文字起こしの処理
    let processedTranscript: TranscriptSegment[] = transcript || [
      { text: 'サンプル文字起こし', startTime: 0, endTime: audioDuration }
    ]

    // 3. 文字起こし結果を分析してキーワードとシーンを抽出
    console.log('文字起こし分析開始')
    const analysisResult = await analyzeTranscriptForKeywords(processedTranscript)
    console.log('分析結果:', analysisResult)

    // 4. 抽出されたキーワードに基づいて素材を検索
    console.log('素材検索開始')
    let videoAssets: VideoAsset[] = customAssets || []
    
    if (analysisResult.scenes.length > 0) {
      const searchedAssets = await searchMediaAssets(analysisResult.keywords, analysisResult.scenes)
      videoAssets = [...videoAssets, ...searchedAssets]
    }
    
    console.log('素材取得完了:', videoAssets.length, '個')
    
    // 5. 素材をタイムラインに配置
    console.log('タイムライン配置開始')
    const timelineResult = await arrangeAssetsOnTimeline(videoAssets, audioDuration)
    console.log('タイムライン配置完了:', timelineResult.timeline.length, '個のセグメント')

    // 5. 動画メタデータの生成（モック）
    const metadata = {
      title: 'テスト動画',
      description: 'テスト用の動画です'
    }
    
    // 6. 実際の動画生成
    console.log('動画生成開始:', new Date().toISOString())
    
    let result: VideoGenerationResult
    let outputPath: string
    let fileSize: number
    
    // 出力ディレクトリを確保
    const outputDir = path.join(process.cwd(), 'public', 'output')
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true })
    }
    
    // ジョブIDを生成
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2)}`
    outputPath = path.join(outputDir, `${jobId}.mp4`)
    console.log('Output path:', outputPath)
    
    console.log('processAudioFile結果:', { audioPath, exists: audioPath ? fs.existsSync(audioPath) : false })
    
    // 文字起こし処理を改善
    let transcriptWithTimestamps: any[] = []
    
    // 既存のtranscriptがある場合はそれを使用
    if (processedTranscript && processedTranscript.length > 0) {
      console.log('既存の文字起こしを使用:', processedTranscript.length, '個のセグメント')
      transcriptWithTimestamps = processedTranscript
    } else if (audioPath && fs.existsSync(audioPath)) {
      try {
        console.log('音声の文字起こしを開始...', audioPath)
        transcriptWithTimestamps = await transcribeAudioWithTimestamps(audioPath)
        console.log('文字起こし完了:', transcriptWithTimestamps.length, '個のセグメント')
      } catch (error) {
        console.error('文字起こしエラー:', error)
        // フォールバック：デフォルトの字幕を作成
        transcriptWithTimestamps = [{
          text: 'Generated Video',
          startTime: 0,
          endTime: audioDuration
        }]
      }
    } else {
      // 音声ファイルがない場合のフォールバック
      console.log('音声ファイルがないため、デフォルトの字幕を作成')
      transcriptWithTimestamps = [{
        text: 'Generated Video Content',
        startTime: 0,
        endTime: audioDuration
      }]
    }
    
    // 音声を字幕として表示する動画生成
    const audioText = typeof audioInput === 'string' ? audioInput : (typeof audioInput.source === 'string' ? audioInput.source : '')
    const tempVideoPath = await generateSubtitleVideo({
      audioPath: audioPath || '',
      audioInput: audioText,
      transcript: transcriptWithTimestamps.length > 0 ? transcriptWithTimestamps : (processedTranscript || []),
      settings,
      tempDir,
      timeline: timelineResult,
      audioDuration
    })
    
    // generateSubtitleVideoは一時ディレクトリに動画を生成するので、
    // 正しい出力パスに直接生成するように変更
    console.log('動画生成を正しい出力パスで実行:', outputPath)
    
    // 一時動画パスではなく、直接最終出力パスを使用
    const finalVideoPath = await generateSubtitleVideo({
      audioPath: audioPath || '',
      audioInput: audioText,
      transcript: transcriptWithTimestamps.length > 0 ? transcriptWithTimestamps : (processedTranscript || []),
      settings,
      tempDir,
      timeline: timelineResult,
      audioDuration,
      outputPath: outputPath  // 直接出力パスを指定
    })
    
    console.log('動画生成完了、最終パス:', finalVideoPath)
    
    // 動画ファイルが生成されたか確認
    if (fs.existsSync(finalVideoPath)) {
      const stats = await fs.promises.stat(finalVideoPath)
      fileSize = stats.size
      console.log('Video file generated successfully:', {
        path: finalVideoPath,
        size: fileSize,
        sizeInMB: (fileSize / 1024 / 1024).toFixed(2) + ' MB'
      })
      
      // public/outputディレクトリの内容も確認
      const outputDir = path.dirname(finalVideoPath)
      const outputFiles = fs.readdirSync(outputDir)
      console.log('出力ディレクトリの内容:', outputFiles)
      
      // outputPathを更新
      outputPath = finalVideoPath
    } else {
      console.error('最終的な動画ファイルが見つかりません:', finalVideoPath)
      throw new Error('動画ファイルの生成に失敗しました')
    }
    
    // 公開用パスを生成（APIルート経由）
    const publicVideoPath = `/api/output/${jobId}.mp4`
    
    result = {
      videoUrl: publicVideoPath,
      thumbnailUrl: videoAssets[0]?.url || 'https://via.placeholder.com/1280x720/0066cc/ffffff?text=Generated+Video',
      duration: audioDuration,
      format: settings.format,
      size: fileSize,
      jobId: jobId
    }
    
    console.log('Video generation completed:', result)
    
    console.log('実際の動画生成完了:', {
      title: metadata.title,
      assets: videoAssets.length,
      outputPath,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(1)}MB`
    })
    
    console.log('動画生成API完了:', new Date().toISOString())
    
    return NextResponse.json({
      success: true,
      result,
      title: metadata.title,
      description: metadata.description,
      scenesCount: analysisResult.scenes.length,
      assetsUsed: videoAssets.length,
      jobId: result.jobId
    }, { status: 200 })
    
  } catch (error: any) {
    console.error('動画生成エラー詳細:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    })
    
    return NextResponse.json(
      {
        error: `動画生成に失敗しました: ${error.message}`,
        code: 'VIDEO_GENERATION_FAILED',
        details: error.stack,
        errorName: error.name
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
