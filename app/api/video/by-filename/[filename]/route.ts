export const runtime = 'nodejs'; // Buffer/fs processing requires Node runtime

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params
    
    // ファイル名の検証
    if (!filename || !filename.endsWith('.mp4')) {
      return NextResponse.json(
        { error: '無効なファイル名です' },
        { status: 400 }
      )
    }
    
    // パストラバーサル攻撃を防ぐ
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: '無効なファイル名です' },
        { status: 400 }
      )
    }
    
    // 一時ディレクトリから最新の動画ファイルを検索
    const tempDir = os.tmpdir()
    
    // video-generation-で始まるディレクトリを検索
    const allDirs = fs.readdirSync(tempDir)
    const videoDirs = allDirs
      .filter(dir => {
        const fullPath = path.join(tempDir, dir)
        return dir.startsWith('video-generation-') && fs.statSync(fullPath).isDirectory()
      })
      .map(dir => ({
        name: dir,
        mtime: fs.statSync(path.join(tempDir, dir)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // 最新順でソート
      .map(item => item.name)
    
    if (videoDirs.length === 0) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 404 }
      )
    }
    
    let filePath: string | null = null
    
    // 最新のディレクトリから動画ファイルを検索
    for (const dir of videoDirs) {
      const potentialPath = path.join(tempDir, dir, filename)
      if (fs.existsSync(potentialPath)) {
        filePath = potentialPath
        break
      }
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 404 }
      )
    }
    
    // ファイルの読み込み
    const fileBuffer = fs.readFileSync(filePath)
    
    // レスポンスヘッダーの設定
    const headers = new Headers()
    headers.set('Content-Type', 'video/mp4')
    headers.set('Content-Length', fileBuffer.length.toString())
    headers.set('Content-Disposition', `inline; filename="${filename}"`)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate') // キャッシュ無効
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
    headers.set('Accept-Ranges', 'bytes') // 動画のシークをサポート
    
    const body = new Uint8Array(fileBuffer)
    return new NextResponse(body, {
      status: 200,
      headers
    })
    
  } catch (error: any) {
    console.error('動画ファイル配信エラー:', error)
    
    return NextResponse.json(
      { error: 'ファイルの読み込みに失敗しました' },
      { status: 500 }
    )
  }
}