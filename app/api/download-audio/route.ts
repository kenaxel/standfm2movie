import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// 音声URLをダウンロードして一時ファイルとして保存するAPI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: '音声URLが必要です' },
        { status: 400 }
      );
    }
    
    console.log(`音声URLをダウンロード中: ${url}`);
    
    // 一時ディレクトリのパス
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // ディレクトリが存在しない場合は作成
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.error('ディレクトリ作成エラー:', err);
    }
    
    // URLからファイルをダウンロード
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ダウンロードに失敗しました: ${response.status} ${response.statusText}`);
    }
    
    // ファイル名を生成（uuidの代わりにランダム文字列を使用）
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const contentType = response.headers.get('content-type') || '';
    const fileExt = contentType.includes('audio/mpeg') ? '.mp3' : 
                    contentType.includes('audio/wav') ? '.wav' : 
                    contentType.includes('audio/ogg') ? '.ogg' : '.mp3';
    
    const fileName = `audio-${Date.now()}-${uniqueId}${fileExt}`;
    const filePath = path.join(tempDir, fileName);
    
    // ファイルを保存
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);
    
    console.log(`音声ファイルを保存しました: ${filePath}`);
    
    // 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      filePath,
      fileName,
      uniqueId,
      originalUrl: url,
      size: buffer.length
    });
  } catch (error) {
    console.error('音声URLダウンロードエラー:', error);
    return NextResponse.json(
      { error: '音声のダウンロードに失敗しました' },
      { status: 500 }
    );
  }
}
