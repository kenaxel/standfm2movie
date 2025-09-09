import { NextRequest, NextResponse } from 'next/server';
import { searchVideos, getCuratedVideos } from '@/lib/pexels';
import { AssetSearchResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, count = 5, orientation = 'landscape', curated = false } = body;
    
    let results: AssetSearchResult[] = [];

    if (curated) {
      // キュレーションされた動画を取得
      try {
        results = await getCuratedVideos(count, orientation);
      } catch (error) {
        console.error('Curated videos error:', error);
        // エラーの場合は検索にフォールバック
        if (query) {
          results = await searchVideos(query, count, orientation);
        }
      }
    } else if (query) {
      // クエリで動画を検索
      try {
        results = await searchVideos(query, count, orientation);
      } catch (error) {
        console.error('Video search error:', error);
      }
    } else {
      return NextResponse.json(
        { error: '検索クエリまたはキュレーションフラグが必要です', code: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      videos: results,
      total: results.length 
    });
  } catch (error: any) {
    console.error('Video search error:', error);
    return NextResponse.json(
      { error: `動画検索に失敗しました: ${error.message}`, code: 'SEARCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const count = parseInt(searchParams.get('count') || '5');
  const orientation = searchParams.get('orientation') || 'landscape';
  const curated = searchParams.get('curated') === 'true';

  try {
    let results: AssetSearchResult[] = [];

    if (curated) {
      // キュレーションされた動画を取得
      try {
        results = await getCuratedVideos(count, orientation as any);
      } catch (error) {
        console.error('Curated videos error:', error);
        // エラーの場合は検索にフォールバック
        if (query) {
          results = await searchVideos(query, count, orientation as any);
        }
      }
    } else if (query) {
      // クエリで動画を検索
      try {
        results = await searchVideos(query, count, orientation as any);
      } catch (error) {
        console.error('Video search error:', error);
      }
    } else {
      return NextResponse.json(
        { error: '検索クエリまたはキュレーションフラグが必要です', code: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      videos: results,
      total: results.length 
    });
  } catch (error: any) {
    console.error('Video search error:', error);
    return NextResponse.json(
      { error: `動画検索に失敗しました: ${error.message}`, code: 'SEARCH_FAILED' },
      { status: 500 }
    );
  }
}