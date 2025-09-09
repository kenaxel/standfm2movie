import axios from 'axios';
import { AssetSearchResult } from '@/types';

const PEXELS_API_URL = 'https://api.pexels.com/v1';
const PEXELS_VIDEO_API_URL = 'https://api.pexels.com/videos';

const pexelsClient = axios.create({
  headers: {
    'Authorization': process.env.PEXELS_API_KEY || '',
  },
});

export async function searchVideos(
  query: string,
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    // APIキーが設定されていない場合はダミーデータを返す
    if (!process.env.PEXELS_API_KEY || process.env.PEXELS_API_KEY === 'your_pexels_api_key_here') {
      console.log('Pexels API key not configured, returning dummy data');
      return Array.from({ length: count }, (_, i) => ({
        id: `dummy-video-${i}`,
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        thumbnailUrl: 'https://via.placeholder.com/640x360/0066cc/ffffff?text=Video+' + (i + 1),
        type: 'video' as const,
        source: 'pexels' as const,
        description: `Sample video for ${query}`,
        tags: [query],
        duration: 10,
      }));
    }

    const response = await pexelsClient.get(`${PEXELS_VIDEO_API_URL}/search`, {
      params: {
        query,
        per_page: count,
        orientation,
        size: 'medium',
      },
    });

    return response.data.videos.map((video: any) => ({
      id: video.id.toString(),
      url: video.video_files.find((file: any) => file.quality === 'hd')?.link || video.video_files[0]?.link,
      thumbnailUrl: video.image,
      type: 'video' as const,
      source: 'pexels' as const,
      description: video.url,
      tags: [query],
      duration: video.duration || 10,
    }));
  } catch (error) {
    console.error('Pexels video search error:', error);
    return [];
  }
}

export async function searchImages(
  query: string,
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    // APIキーが設定されていない場合はダミーデータを返す
    if (!process.env.PEXELS_API_KEY || process.env.PEXELS_API_KEY === 'your_pexels_api_key_here') {
      console.log('Pexels API key not configured, returning dummy data');
      return Array.from({ length: count }, (_, i) => ({
        id: `dummy-image-${i}`,
        url: `https://via.placeholder.com/1920x1080/0066cc/ffffff?text=Image+${i + 1}+for+${encodeURIComponent(query)}`,
        thumbnailUrl: `https://via.placeholder.com/640x360/0066cc/ffffff?text=Image+${i + 1}`,
        type: 'image' as const,
        source: 'pexels' as const,
        description: `Sample image for ${query}`,
        tags: [query],
      }));
    }

    const response = await pexelsClient.get(`${PEXELS_API_URL}/search`, {
      params: {
        query,
        per_page: count,
        orientation,
        size: 'medium',
      },
    });

    return response.data.photos.map((photo: any) => ({
      id: photo.id.toString(),
      url: photo.src.large,
      thumbnailUrl: photo.src.medium,
      type: 'image' as const,
      source: 'pexels' as const,
      description: photo.alt || query,
      tags: [query],
    }));
  } catch (error) {
    console.error('Pexels image search error:', error);
    return [];
  }
}

export async function getCuratedVideos(
  count: number = 5,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape'
): Promise<AssetSearchResult[]> {
  try {
    const response = await pexelsClient.get(`${PEXELS_VIDEO_API_URL}/popular`, {
      params: {
        per_page: count,
        orientation,
      },
    });

    return response.data.videos.map((video: any) => ({
      id: video.id.toString(),
      url: video.video_files.find((file: any) => file.quality === 'hd')?.link || video.video_files[0]?.link,
      thumbnailUrl: video.image,
      type: 'video' as const,
      source: 'pexels' as const,
      description: 'Curated video',
      tags: ['popular'],
      duration: video.duration || 10,
    }));
  } catch (error) {
    console.error('Pexels curated videos error:', error);
    return [];
  }
}