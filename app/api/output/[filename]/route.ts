import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename
    const filePath = path.join(process.cwd(), 'public', 'output', filename)
    
    console.log('動画ファイル配信要求:', {
      filename,
      filePath,
      cwd: process.cwd(),
      requestUrl: request.url
    })
    
    // 出力ディレクトリの存在確認
    const outputDir = path.join(process.cwd(), 'public', 'output')
    if (!fs.existsSync(outputDir)) {
      console.error('出力ディレクトリが存在しません:', outputDir)
      return NextResponse.json(
        { error: '出力ディレクトリが見つかりません' },
        { status: 404 }
      )
    }
    
    // ディレクトリの内容を確認
    const dirContents = fs.readdirSync(outputDir)
    console.log('出力ディレクトリの内容:', dirContents)
    
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      console.error('動画ファイルが見つかりません:', {
        filePath,
        dirContents,
        requestedFilename: filename
      })
      return NextResponse.json(
        { 
          error: 'ファイルが見つかりません',
          details: {
            requestedFile: filename,
            availableFiles: dirContents,
            searchPath: filePath
          }
        },
        { status: 404 }
      )
    }
    
    // ファイル情報を取得
    const stats = fs.statSync(filePath)
    const fileSize = stats.size
    
    console.log('動画ファイル情報:', { filename, size: fileSize, path: filePath })
    
    // ファイルを読み込み
    const fileBuffer = fs.readFileSync(filePath)
    
    // レスポンスヘッダーを設定
    const headers = new Headers()
    headers.set('Content-Type', 'video/mp4')
    headers.set('Content-Length', fileSize.toString())
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
    
    // Range リクエストの処理
    const range = request.headers.get('range')
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1
      
      const chunk = fileBuffer.slice(start, end + 1)
      
      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      headers.set('Content-Length', chunksize.toString())
      
      return new NextResponse(chunk, {
        status: 206,
        headers
      })
    }
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers
    })
    
  } catch (error) {
    console.error('動画ファイル配信エラー:', error)
    return NextResponse.json(
      { error: 'ファイルの読み込みに失敗しました' },
      { status: 500 }
    )
  }
}
