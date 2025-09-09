import { NextRequest, NextResponse } from 'next/server';
import { searchPhotos } from '@/lib/unsplash';
import { searchImages } from '@/lib/pexels';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, count = 5, source = 'both', orientation = 'landscape' } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です', code: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    let results = [];

    // Unsplashから画像を検索
    if (source === 'unsplash' || source === 'both') {
      try {
        const unsplashResults = await searchPhotos(query, Math.ceil(count / 2), orientation);
        results.push(...unsplashResults);
      } catch (error) {
        console.error('Unsplash search error:', error);
      }
    }

    // Pexelsから画像を検索
    if (source === 'pexels' || source === 'both') {
      try {
        const pexelsResults = await searchImages(query, Math.ceil(count / 2), orientation);
        results.push(...pexelsResults);
      } catch (error) {
        console.error('Pexels search error:', error);
      }
    }

    // 結果をシャッフルして指定された数に制限
    const shuffledResults = results.sort(() => Math.random() - 0.5).slice(0, count);

    return NextResponse.json({ 
      images: shuffledResults,
      total: shuffledResults.length 
    });
  } catch (error: any) {
    console.error('Image search error:', error);
    return NextResponse.json(
      { error: `画像検索に失敗しました: ${error.message}`, code: 'SEARCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const count = parseInt(searchParams.get('count') || '5');
  const source = searchParams.get('source') || 'both';
  const orientation = searchParams.get('orientation') || 'landscape';

  if (!query) {
    return NextResponse.json(
      { error: '検索クエリが必要です', code: 'MISSING_QUERY' },
      { status: 400 }
    );
  }

  try {
    let results = [];

    // Unsplashから画像を検索
    if (source === 'unsplash' || source === 'both') {
      try {
        const unsplashResults = await searchPhotos(query, Math.ceil(count / 2), orientation as any);
        results.push(...unsplashResults);
      } catch (error) {
        console.error('Unsplash search error:', error);
      }
    }

    // Pexelsから画像を検索
    if (source === 'pexels' || source === 'both') {
      try {
        const pexelsResults = await searchImages(query, Math.ceil(count / 2), orientation as any);
        results.push(...pexelsResults);
      } catch (error) {
        console.error('Pexels search error:', error);
      }
    }

    // 結果をシャッフルして指定された数に制限
    const shuffledResults = results.sort(() => Math.random() - 0.5).slice(0, count);

    return NextResponse.json({ 
      images: shuffledResults,
      total: shuffledResults.length 
    });
  } catch (error: any) {
    console.error('Image search error:', error);
    return NextResponse.json(
      { error: `画像検索に失敗しました: ${error.message}`, code: 'SEARCH_FAILED' },
      { status: 500 }
    );
  }
}