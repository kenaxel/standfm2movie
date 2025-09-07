import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// 動画ファイルを提供するAPI
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    
    if (!jobId) {
      return new NextResponse('ジョブIDが必要です', { status: 400 });
    }
    
    console.log(`動画ファイルリクエスト: jobId=${jobId}`);
    
    // 出力ディレクトリのパス
    const outputDir = path.join(process.cwd(), 'public', 'output');
    
    // ジョブIDに基づく動画ファイルのパス
    const videoPath = path.join(outputDir, `${jobId}.mp4`);
    
    // ファイルが存在するか確認
    if (!fs.existsSync(videoPath)) {
      console.error(`動画ファイルが見つかりません: ${videoPath}`);
      return new NextResponse('動画ファイルが見つかりません', { status: 404 });
    }
    
    // ファイルサイズを取得
    const stat = await fsPromises.stat(videoPath);
    
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
    
    // 動画ファイルを返す
    return new NextResponse(videoBuffer, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error('動画ファイル提供エラー:', error);
    return new NextResponse('サーバーエラー', { status: 500 });
  }
}
