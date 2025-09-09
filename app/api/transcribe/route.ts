import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import FormData from 'form-data'
import puppeteer from 'puppeteer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// ファイルサイズ制限（15MB）
const MAX_FILE_SIZE = 15 * 1024 * 1024

// デモモード設定
const DEMO_MODE = false
const DEMO_DURATION = 30 // 秒

// Puppeteerを使用してStand.fmから音声URLを抽出
async function extractAudioUrlWithPuppeteer(url: string): Promise<string | null> {
  let browser = null
  
  try {
    console.log('Puppeteerで音声URL抽出開始:', url)
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
    })
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // ネットワークリクエストを監視
    const audioUrls: string[] = []
    page.on('response', async (response) => {
      const responseUrl = response.url()
      if (responseUrl.match(/\.(mp3|m4a|wav|ogg|flac)$/i) || responseUrl.includes('audio')) {
        console.log('音声URLを検出:', responseUrl)
        audioUrls.push(responseUrl)
      }
    })
    
    // ページを読み込み
    console.log('ページ読み込み開始...')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
    console.log('ページ読み込み完了')
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // ネットワークから音声URLが取得できた場合
    if (audioUrls.length > 0) {
      console.log('ネットワークから音声URLを取得:', audioUrls[0])
      return audioUrls[0]
    }
    
    // HTMLから音声URLを抽出
    console.log('HTMLから音声URL抽出を試行...')
    const html = await page.content()
    const extractedUrl = extractAudioUrlFromHtml(html)
    if (extractedUrl) {
      console.log('HTMLから音声URLを抽出:', extractedUrl)
    } else {
      console.log('HTMLからの音声URL抽出に失敗')
    }
    return extractedUrl
    
  } catch (error: any) {
    console.error('Puppeteerエラー:', error.message || error)
    if (error.message && error.message.includes('timeout')) {
      console.error('Puppeteerタイムアウト: ページの読み込みに時間がかかりすぎています')
    }
    return null
  } finally {
    if (browser) {
      try {
        await browser.close()
        console.log('Puppeteerブラウザを閉じました')
      } catch (closeError) {
        console.error('ブラウザクローズエラー:', closeError)
      }
    }
  }
}

// HTMLから音声URLを抽出する関数
function extractAudioUrlFromHtml(html: string): string | null {
  // パターン1: og:audio
  let match = html.match(/<meta property="og:audio" content="([^"]+)"/)
  if (match && match[1]) {
    console.log('og:audioから音声URLを取得:', match[1])
    return match[1]
  }
  
  // パターン2: og:audio:secure_url
  match = html.match(/<meta property="og:audio:secure_url" content="([^"]+)"/)
  if (match && match[1]) {
    console.log('og:audio:secure_urlから音声URLを取得:', match[1])
    return match[1]
  }
  
  // パターン3: audio要素のsrc属性
  match = html.match(/<audio[^>]+src="([^"]+)"/)
  if (match && match[1]) {
    console.log('audio要素から音声URLを取得:', match[1])
    return match[1]
  }
  
  // パターン4: JSONデータ内の音声URL
  match = html.match(/"audioUrl"\s*:\s*"([^"]+)"/)
  if (match && match[1]) {
    console.log('JSONデータから音声URLを取得:', match[1])
    return match[1]
  }
  
  // パターン5: __NEXT_DATA__からの抽出
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/)
  if (nextDataMatch && nextDataMatch[1]) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const audioUrl = findAudioUrlInObject(nextData)
      if (audioUrl) {
        console.log('__NEXT_DATA__から音声URLを取得:', audioUrl)
        return audioUrl
      }
    } catch (e) {
      console.log('__NEXT_DATA__の解析に失敗')
    }
  }
  
  console.log('音声URLが見つかりませんでした')
  return null
}

// オブジェクトから音声URLを再帰的に検索
function findAudioUrlInObject(obj: any): string | null {
  if (typeof obj === 'string') {
    if (obj.match(/\.(mp3|m4a|wav|ogg|flac)$/i) || obj.includes('audio')) {
      return obj
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (key.toLowerCase().includes('audio') || key.toLowerCase().includes('media')) {
        const result = findAudioUrlInObject(obj[key])
        if (result) return result
      }
    }
    for (const key in obj) {
      const result = findAudioUrlInObject(obj[key])
      if (result) return result
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let audioFile: File | null = null
    let audioUrl: string | null = null
    
    if (contentType.includes('application/json')) {
      // JSON形式でURLが送信された場合
      const body = await request.json()
      audioUrl = body.url || body.audioUrl
    } else if (contentType.includes('multipart/form-data')) {
      // FormData形式でファイルまたはURLが送信された場合
      const formData = await request.formData()
      audioFile = formData.get('audio') as File | null || formData.get('file') as File | null
      audioUrl = formData.get('audioUrl') as string | null
    } else {
      return NextResponse.json(
        { error: 'Content-Typeは"multipart/form-data"または"application/json"である必要があります', code: 'INVALID_CONTENT_TYPE' },
        { status: 400 }
      )
    }

    if (!audioFile && !audioUrl) {
      return NextResponse.json(
        { error: '音声ファイルまたはURLが必要です', code: 'NO_AUDIO_INPUT' },
        { status: 400 }
      )
    }

    let tempFilePath: string
    let actualAudioUrl: string | null = null

    if (audioUrl) {
      console.log('音声URL処理開始:', audioUrl)
      
      // Stand.fmのURLかチェック
      if (audioUrl.includes('stand.fm')) {
        console.log('Stand.fmのURLを検出、音声URLを抽出中...')
        
        // Puppeteerで音声URLを抽出
        actualAudioUrl = await extractAudioUrlWithPuppeteer(audioUrl)
        
        if (!actualAudioUrl) {
          // フォールバック: 従来のfetch方式
          console.log('フォールバック: fetchで取得中...')
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)
            
            const response = await fetch(audioUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              signal: controller.signal
            })
            
            clearTimeout(timeoutId)
            
            console.log('フォールバックfetchレスポンス:', response.status, response.statusText)
            if (response.ok) {
              const html = await response.text()
              actualAudioUrl = extractAudioUrlFromHtml(html)
              if (actualAudioUrl) {
                console.log('フォールバックで音声URLを取得:', actualAudioUrl)
              } else {
                console.log('フォールバックでもHTMLから音声URLを抽出できませんでした')
              }
            } else {
              console.log('フォールバックfetchが失敗:', response.status, response.statusText)
            }
          } catch (fetchError: any) {
            console.error('フォールバック取得も失敗:', fetchError.message || fetchError)
          }
        }
        
        if (!actualAudioUrl) {
          return NextResponse.json(
            { error: '音声URLが見つかりません', code: 'AUDIO_URL_NOT_FOUND' },
            { status: 400 }
          )
        }
        
        console.log('抽出した音声URL:', actualAudioUrl)
      } else {
        actualAudioUrl = audioUrl
      }

      // 音声ファイルをダウンロード
      console.log('音声ファイルをダウンロード中:', actualAudioUrl)
      const audioResponse = await fetch(actualAudioUrl)
      
      if (!audioResponse.ok) {
        throw new Error(`音声ファイルのダウンロードに失敗: ${audioResponse.status} ${audioResponse.statusText}`)
      }

      const audioBuffer = await audioResponse.arrayBuffer()
      const audioData = new Uint8Array(audioBuffer)

      if (audioData.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `ファイルサイズが大きすぎます（最大${MAX_FILE_SIZE / 1024 / 1024}MB）`, code: 'FILE_TOO_LARGE' },
          { status: 400 }
        )
      }

      // 一時ファイルに保存
      const tempDir = os.tmpdir()
      tempFilePath = path.join(tempDir, `audio_${Date.now()}.mp3`)
      fs.writeFileSync(tempFilePath, audioData)
      console.log('音声ファイルを一時保存:', tempFilePath)
    } else {
      // ファイルアップロードの場合
      if (!audioFile || audioFile.size === 0) {
        return NextResponse.json(
          { error: '有効な音声ファイルが必要です', code: 'INVALID_AUDIO_FILE' },
          { status: 400 }
        )
      }

      if (audioFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `ファイルサイズが大きすぎます（最大${MAX_FILE_SIZE / 1024 / 1024}MB）`, code: 'FILE_TOO_LARGE' },
          { status: 400 }
        )
      }

      const audioBuffer = await audioFile.arrayBuffer()
      const audioData = new Uint8Array(audioBuffer)

      const tempDir = os.tmpdir()
      tempFilePath = path.join(tempDir, `audio_${Date.now()}.${audioFile.name.split('.').pop() || 'mp3'}`)
      fs.writeFileSync(tempFilePath, audioData)
      console.log('アップロードファイルを一時保存:', tempFilePath)
    }

    // 音声の長さを取得
    let duration = 0
    try {
      const ffprobeOutput = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tempFilePath}"`, { encoding: 'utf8' })
      duration = parseFloat(ffprobeOutput.trim())
      console.log('音声の長さ:', duration, '秒')
    } catch (error) {
      console.log('音声の長さ取得に失敗:', error)
    }

    // 音声ファイルをWhisper APIがサポートする形式に変換
    const convertedTempFilePath = path.join(os.tmpdir(), `audio_converted_${Date.now()}.mp3`)
    try {
      console.log('音声ファイルをmp3形式に変換中...')
      if (DEMO_MODE && duration > DEMO_DURATION) {
        console.log(`デモモード: 音声を${DEMO_DURATION}秒に短縮してmp3に変換`)
        execSync(`ffmpeg -i "${tempFilePath}" -t ${DEMO_DURATION} -acodec libmp3lame -ab 128k "${convertedTempFilePath}"`, { stdio: 'ignore' })
        duration = DEMO_DURATION
      } else {
        execSync(`ffmpeg -i "${tempFilePath}" -acodec libmp3lame -ab 128k "${convertedTempFilePath}"`, { stdio: 'ignore' })
      }
      
      // 元のファイルを削除
      fs.unlinkSync(tempFilePath)
      tempFilePath = convertedTempFilePath
      console.log('音声ファイル変換完了:', tempFilePath)
    } catch (conversionError) {
      console.error('音声ファイル変換エラー:', conversionError)
      // 変換に失敗した場合は元のファイルをそのまま使用
      console.log('元のファイルをそのまま使用します')
    }

    // OpenAI Whisper APIで文字起こし
    console.log('OpenAI Whisper APIで文字起こし開始')
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'ja'
    })

    // 一時ファイルを削除
    fs.unlinkSync(tempFilePath)
    console.log('一時ファイルを削除:', tempFilePath)

    console.log('文字起こし完了')
    return NextResponse.json({
      transcript: transcription.text,
      duration: Math.round(duration)
    })

  } catch (error: any) {
    console.error('エラー:', error)
    
    // エラーの種類に応じて適切なレスポンスを返す
    if (error.message.includes('音声URLが見つかりません')) {
      return NextResponse.json(
        { error: '音声URLが見つかりません', code: 'AUDIO_URL_NOT_FOUND' },
        { status: 400 }
      )
    }
    
    if (error.message.includes('タイムアウト')) {
      return NextResponse.json(
        { error: 'リクエストがタイムアウトしました', code: 'TIMEOUT' },
        { status: 408 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || '音声の処理中にエラーが発生しました', code: 'PROCESSING_ERROR' },
      { status: 500 }
    )
  }
}
