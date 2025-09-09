import axios from 'axios';
import { AssetSearchResult } from '@/types';

const UNSPLASH_API_URL = 'https://api.unsplash.com';

const unsplashClient = axios.create({
  headers: {
    'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || ''}`,
  },
});

export async function searchPhotos(
  query: string,
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    // APIキーが設定されていない場合はダミーデータを返す
    if (!process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY === 'your_unsplash_access_key_here') {
      console.log('Unsplash API key not configured, returning dummy data');
      return Array.from({ length: count }, (_, i) => ({
        id: `dummy-unsplash-${i}`,
        url: `https://via.placeholder.com/1920x1080/4a90e2/ffffff?text=Unsplash+${i + 1}+for+${encodeURIComponent(query)}`,
        thumbnailUrl: `https://via.placeholder.com/640x360/4a90e2/ffffff?text=Unsplash+${i + 1}`,
        type: 'image' as const,
        source: 'unsplash' as const,
        description: `Sample Unsplash image for ${query}`,
        tags: [query],
      }));
    }

    const response = await unsplashClient.get(`${UNSPLASH_API_URL}/search/photos`, {
      params: {
        query,
        per_page: count,
        orientation,
        order_by: 'relevant',
      },
    });

    return response.data.results.map((photo: any) => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      type: 'image' as const,
      source: 'unsplash' as const,
      description: photo.alt_description || photo.description || query,
      tags: photo.tags?.map((tag: any) => tag.title) || [query],
    }));
  } catch (error) {
    console.error('Unsplash search error:', error);
    return [];
  }
}

export async function getFeaturedPhotos(
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    const response = await unsplashClient.get(`${UNSPLASH_API_URL}/photos`, {
      params: {
        per_page: count,
        order_by: 'popular',
      },
    });

    // orientationでフィルタリング
    const filteredPhotos = response.data.filter((photo: any) => {
      const ratio = photo.width / photo.height;
      if (orientation === 'landscape') return ratio > 1.2;
      if (orientation === 'portrait') return ratio < 0.8;
      return ratio >= 0.8 && ratio <= 1.2; // squarish
    });

    return filteredPhotos.slice(0, count).map((photo: any) => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      type: 'image' as const,
      source: 'unsplash' as const,
      description: photo.alt_description || photo.description || 'Featured photo',
      tags: photo.tags?.map((tag: any) => tag.title) || ['featured'],
    }));
  } catch (error) {
    console.error('Unsplash featured photos error:', error);
    return [];
  }
}

export async function getPhotosByCategory(
  category: string,
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    const response = await unsplashClient.get(`${UNSPLASH_API_URL}/topics/${category}/photos`, {
      params: {
        per_page: count,
        orientation,
      },
    });

    return response.data.map((photo: any) => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      type: 'image' as const,
      source: 'unsplash' as const,
      description: photo.alt_description || photo.description || category,
      tags: [category],
    }));
  } catch (error) {
    console.error('Unsplash category photos error:', error);
    return [];
  }
}