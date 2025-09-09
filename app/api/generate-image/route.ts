import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, tone, purpose } = body
    
    if (!title) {
      return NextResponse.json(
        { error: 'タイトルが見つかりません', code: 'GENERATION_FAILED' },
        { status: 400 }
      )
    }

    // 画像生成プロンプト
    const prompt = generateImagePrompt(title, tone, purpose)
    
    // DALL-E 3で画像生成
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      style: 'natural'
    })
    
    // レスポンスの型チェックと安全な取得
    const imageUrl = response.data && response.data.length > 0 ? response.data[0].url : null
    
    if (!imageUrl) {
      throw new Error('画像URLが生成されませんでした')
    }
    
    return NextResponse.json({ imageUrl })
  } catch (error: any) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: `画像生成に失敗しました: ${error.message}`, code: 'GENERATION_FAILED' },
      { status: 500 }
    )
  }
}

// 画像生成プロンプト
function generateImagePrompt(title: string, tone: string, purpose: string): string {
  const basePrompt = "A warm, professional illustration for a blog article"
  const audienceStyle = "featuring a modern Japanese mom working from home"
  const visualStyle = "soft pastel colors, clean minimal design, wide 16:9 composition"
  
  const purposeMap: Record<string, string> = {
    '集客': 'confident and inspiring atmosphere',
    '教育': 'learning and growth focused',
    '日記': 'personal and relatable mood'
  }
  
  const purposeStyle = purposeMap[purpose] || 'professional and engaging style'
  
  return `${basePrompt}, ${audienceStyle}, ${purposeStyle}, ${visualStyle}, theme related to "${title}". No text or words in the image.`
}





