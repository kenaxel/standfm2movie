import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

// 動画ファイルをストリーミングするAPI（最適化版）
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    
    if (!jobId) {
      return new NextResponse('ジョブIDが必要です', { status: 400 });
    }
    
    console.log(`動画ストリーミングリクエスト: jobId=${jobId}`);
    
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
    const fileSize = stat.size;
    
    // Range リクエストのサポート
    const range = request.headers.get('range');
    
    if (range) {
      // Range リクエストの処理
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      console.log(`Range リクエスト: ${start}-${end}/${fileSize}`);
      
      // ファイルの一部を読み込む
      const fileStream = createReadStream(videoPath, { start, end });
      const chunks: Buffer[] = [];
      
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      
      // レスポンスヘッダーを設定
      const headers = new Headers();
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
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
      // 小さなチャンクサイズを設定
      const CHUNK_SIZE = 1024 * 1024; // 1MB
      
      // 最初のチャンクだけを返す
      const fileStream = createReadStream(videoPath, { start: 0, end: CHUNK_SIZE - 1 });
      const chunks: Buffer[] = [];
      
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      
      // レスポンスヘッダーを設定
      const headers = new Headers();
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Length', Math.min(CHUNK_SIZE, fileSize).toString());
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      
      // 最初のチャンクを返す
      return new NextResponse(buffer, {
        status: 200,
        headers
      });
    }
  } catch (error) {
    console.error('動画ストリーミングエラー:', error);
    return new NextResponse('サーバーエラー', { status: 500 });
  }
}
