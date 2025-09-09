import OpenAI from 'openai'
import { SceneAnalysis, TranscriptSegment } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * 音声文字起こしからシーン分析を行う
 */
export async function analyzeAudioForScenes(transcript: string): Promise<SceneAnalysis> {
  try {
    const prompt = `
以下の音声文字起こしを分析し、動画生成に適したシーンに分割してください。
各シーンには適切な背景画像や動画を提案してください。

文字起こし:
${transcript}

以下のJSON形式で回答してください:
{
  "scenes": [
    {
      "description": "シーンの説明",
      "keywords": ["検索キーワード1", "検索キーワード2"],
      "startTime": 0,
      "endTime": 30,
      "suggestedAssets": ["具体的な素材の説明"]
    }
  ]
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたは動画制作の専門家です。音声コンテンツを分析し、視覚的に魅力的な動画シーンを提案します。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('OpenAI APIからの応答が空です')
    }

    return JSON.parse(response) as SceneAnalysis
  } catch (error) {
    console.error('シーン分析エラー:', error)
    throw new Error(`シーン分析に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * シーンの説明から素材検索キーワードを生成
 */
export async function generateSearchKeywords(sceneDescription: string): Promise<string[]> {
  try {
    const prompt = `
以下のシーン説明から、画像・動画素材を検索するための効果的なキーワードを5個生成してください。
キーワードは英語で、具体的で検索しやすいものにしてください。

シーン説明: ${sceneDescription}

以下のJSON形式で回答してください:
{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたは素材検索の専門家です。シーンに最適な検索キーワードを生成します。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    })

    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('OpenAI APIからの応答が空です')
    }

    const parsed = JSON.parse(response)
    return parsed.keywords || []
  } catch (error) {
    console.error('キーワード生成エラー:', error)
    throw new Error(`キーワード生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 文字起こしからタイムスタンプ付きセグメントを生成
 */
export async function generateTimestampedSegments(transcript: string, audioDuration: number): Promise<TranscriptSegment[]> {
  try {
    const prompt = `
以下の文字起こしを、${audioDuration}秒の音声に対して適切なタイムスタンプ付きセグメントに分割してください。
各セグメントは5-15秒程度の長さにし、自然な区切りで分けてください。

文字起こし:
${transcript}

以下のJSON形式で回答してください:
{
  "segments": [
    {
      "text": "セグメントのテキスト",
      "startTime": 0,
      "endTime": 10
    }
  ]
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたは音声編集の専門家です。文字起こしを適切なタイムスタンプ付きセグメントに分割します。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('OpenAI APIからの応答が空です')
    }

    const parsed = JSON.parse(response)
    return parsed.segments || []
  } catch (error) {
    console.error('セグメント生成エラー:', error)
    throw new Error(`セグメント生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * DALL-E 3を使用して画像を生成
 */
export async function generateImage(prompt: string, size: '1024x1024' | '1792x1024' | '1024x1792' = '1792x1024'): Promise<string> {
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'standard',
      style: 'natural'
    })

    const imageUrl = response.data?.[0]?.url
    if (!imageUrl) {
      throw new Error('画像URLが生成されませんでした')
    }

    return imageUrl
  } catch (error) {
    console.error('画像生成エラー:', error)
    throw new Error(`画像生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 動画タイトルとサムネイル用のプロンプトを生成
 */
export async function generateVideoMetadata(transcript: string): Promise<{ title: string; description: string; thumbnailPrompt: string }> {
  try {
    const prompt = `
以下の音声文字起こしから、魅力的な動画タイトル、説明文、サムネイル画像生成用のプロンプトを作成してください。

文字起こし:
${transcript}

以下のJSON形式で回答してください:
{
  "title": "魅力的な動画タイトル（50文字以内）",
  "description": "動画の説明文（200文字以内）",
  "thumbnailPrompt": "サムネイル画像生成用の英語プロンプト"
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたは動画マーケティングの専門家です。視聴者の興味を引く魅力的なタイトルと説明文を作成します。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('OpenAI APIからの応答が空です')
    }

    return JSON.parse(response)
  } catch (error) {
    console.error('メタデータ生成エラー:', error)
    throw new Error(`メタデータ生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}