import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GenerationSettings, GeneratedContent } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, settings } = body as {
      transcript: string
      settings: GenerationSettings
    }
    
    if (!transcript) {
      return NextResponse.json(
        { error: '文字起こしが見つかりません', code: 'GENERATION_FAILED' },
        { status: 400 }
      )
    }

    // 記事生成プロンプトを作成
    const prompt = generateArticlePrompt(transcript, settings)
    
    // GPT-4で記事生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは優秀なコンテンツライターです。音声文字起こしから魅力的な記事を生成します。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
    
    const generatedText = completion.choices[0].message.content || ''
    
    // 生成されたテキストをパースして構造化
    const content = parseGeneratedContent(generatedText, settings)
    
    return NextResponse.json(content)
  } catch (error: any) {
    console.error('Article generation error:', error)
    return NextResponse.json(
      { error: `記事生成に失敗しました: ${error.message}`, code: 'GENERATION_FAILED' },
      { status: 500 }
    )
  }
}

// プロンプト生成（処理モードに応じて分岐）
function generateArticlePrompt(transcript: string, settings: GenerationSettings): string {
  if (settings.processingMode === 'natural') {
    return generateNaturalPrompt(transcript, settings)
  } else {
    return generateArticleStructurePrompt(transcript, settings)
  }
}

// Aモード: 自然な文体変換プロンプト
function generateNaturalPrompt(transcript: string, settings: GenerationSettings): string {
  return `以下の音声文字起こしを、自然で読みやすい文章に修正してください。

【文字起こし】
${transcript}

【修正方針】
- 口調: ${settings.tone}
- 話し言葉を書き言葉に変換
- 不自然な繰り返しや「えー」「あのー」などの除去
- 文章の流れを整理
- 内容は元の話をそのまま保持

【出力フォーマット】
修正された文章をそのまま出力してください。見出しや構成は不要です。`
}

// Bモード: 記事構成プロンプト（改良版）
function generateArticleStructurePrompt(transcript: string, settings: GenerationSettings): string {
  return `下記は音声配信の文字起こしです。
これをベースにして、note記事として自然に読めるように整えてください。

# 出力条件
- タイトルを付けること
- 導入文（あいさつ＋テーマ提示）を入れること
- 見出し（##）で流れを整理すること
- 冗長な部分や「えー」「あのー」などの口語は削除すること
- 内容は残しつつ、読みやすい文章に整えること
- 最後にまとめと読者への一言（例: フォローやスキを促す）

【設定】
- 口調: ${settings.tone}

# 入力
${transcript}

必ず以下のフォーマットで出力してください：

# タイトル
[ここにタイトル]

# 導入文
[ここに導入文（あいさつ＋テーマ提示）]

# 本文
[ここに本文（見出し##を使って整理）]

# まとめ
[ここにまとめと読者への一言]

# Markdown
[上記すべてを含むnote用のMarkdown形式]`
}

// 生成されたテキストをパース
function parseGeneratedContent(text: string, settings: GenerationSettings): GeneratedContent {
  // Aモード（自然な文体変換）の場合は、シンプルな構造で返す
  if (settings.processingMode === 'natural') {
    return {
      seoTitle: '文字起こし結果（修正版）',
      leadText: '',
      content: text.trim(),
      cta: '',
      metaDescription: '',
      tags: [],
      coverImageUrl: '',
      markdown: text.trim()
    }
  }
  
  // Bモード（記事構成）の場合は、従来通りのパース処理
  // セクション別に分割
  const sections: Record<string, string> = {}
  let currentSection = ''
  let markdownContent = ''
  
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.startsWith('# ')) {
      currentSection = line.substring(2).trim()
      sections[currentSection] = ''
    } else if (currentSection) {
      sections[currentSection] += line + '\n'
    }
  }
  
  // Markdownセクションがない場合は、他のセクションから構築
  if (!sections['Markdown']) {
    markdownContent = `# ${sections['タイトル']?.trim() || ''}

${sections['導入文']?.trim() || ''}

${sections['本文']?.trim() || ''}

${sections['まとめ']?.trim() || ''}`
  } else {
    markdownContent = sections['Markdown'].trim()
  }
  
  return {
    seoTitle: sections['タイトル']?.trim() || '生成されたタイトル',
    leadText: sections['導入文']?.trim() || '',
    content: sections['本文']?.trim() || '',
    cta: sections['まとめ']?.trim() || '',
    metaDescription: '',
    tags: [],
    coverImageUrl: '', // 画像生成APIで後から設定
    markdown: markdownContent
  }
}





