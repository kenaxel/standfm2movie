export const runtime = 'nodejs'; // fs/Buffer系を安定動作させる

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { createReadStream } from 'fs';

// 直接ファイル名で動画ファイルをストリーミングするAPI（最適化版）
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    if (!filename) {
      return new NextResponse('ファイル名が必要です', { status: 400 });
    }
    
    console.log(`動画ストリーミングリクエスト: filename=${filename}`);
    
    // 出力ディレクトリのパス
    const outputDir = path.join(process.cwd(), 'public', 'output');
    
    // ファイル名に基づく動画ファイルのパス
    const videoPath = path.join(outputDir, filename);
    
    // ファイルが存在するか確認
    if (!fs.existsSync(videoPath)) {
      console.error(`動画ファイルが見つかりません: ${videoPath}`);
      return new NextResponse('動画ファイルが見つかりません', { status: 404 });
    }
    
    // ファイルサイズを取得
    const stat = await fsPromises.stat(videoPath);
    const fileSize = stat.size;
    
    try {
      // 直接ファイルを返す（ストリーミングではなく）
      const videoBuffer = await fsPromises.readFile(videoPath);
      
      // レスポンスヘッダーを設定
      const headers = new Headers();
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Length', stat.size.toString());
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // 動画ファイルを返す（Bufferは直接NG → Uint8Array or Blobにして返す）
      const body = new Uint8Array(videoBuffer); // これで BodyInit 扱いになる
      return new NextResponse(body, {
        status: 200,
        headers
      });
    } catch (readError) {
      console.error('ファイル読み込みエラー:', readError);
      return new NextResponse('ファイルの読み込みに失敗しました', { status: 500 });
    }
  } catch (error) {
    console.error('動画ストリーミングエラー:', error);
    return new NextResponse('サーバーエラー', { status: 500 });
  }
}
