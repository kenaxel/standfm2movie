import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 一時的な音声ファイルをアップロードするAPI
export async function POST(request: NextRequest) {
  try {
    // FormDataからファイルを取得
    const formData = await request.formData();
    const file = formData.get('audioFile') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '音声ファイルが必要です' },
        { status: 400 }
      );
    }
    
    // 一時ディレクトリのパス
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // ディレクトリが存在しない場合は作成
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.error('ディレクトリ作成エラー:', err);
    }
    
    // ファイル名を生成
    const fileExt = path.extname(file.name);
    const uniqueId = uuidv4();
    const fileName = `audio-${Date.now()}-${uniqueId}${fileExt}`;
    const filePath = path.join(tempDir, fileName);
    
    // ファイルをバッファに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // ファイルを保存
    await fs.writeFile(filePath, buffer);
    
    console.log(`音声ファイルを保存しました: ${filePath}`);
    
    // 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      filePath,
      fileName,
      uniqueId,
      originalName: file.name,
      size: file.size
    });
  } catch (error) {
    console.error('音声ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
