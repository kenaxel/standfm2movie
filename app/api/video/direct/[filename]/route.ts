import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// 直接ファイル名で動画ファイルを提供するAPI
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    if (!filename) {
      return new NextResponse('ファイル名が必要です', { status: 400 });
    }
    
    console.log(`動画ファイルリクエスト: filename=${filename}`);
    
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
    
    // Range リクエストのサポート
    const range = request.headers.get('range');
    
    if (range) {
      // Range リクエストの処理
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = (end - start) + 1;
      
      console.log(`Range リクエスト: ${start}-${end}/${stat.size}`);
      
      // ファイルの一部を読み込む
      const fileHandle = await fsPromises.open(videoPath, 'r');
      const buffer = Buffer.alloc(chunkSize);
      await fileHandle.read(buffer, 0, chunkSize, start);
      await fileHandle.close();
      
      // レスポンスヘッダーを設定
      const headers = new Headers();
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', chunkSize.toString());
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      
      // 部分的なコンテンツを返す
      return new NextResponse(buffer, {
        status: 206,
        headers
      });
    } else {
      // 通常のリクエストの処理
      // ファイルを読み込む
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
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      
      // 動画ファイルを返す
      return new NextResponse(videoBuffer, {
        status: 200,
        headers
      });
    }
  } catch (error) {
    console.error('動画ファイル提供エラー:', error);
    return new NextResponse('サーバーエラー', { status: 500 });
  }
}
