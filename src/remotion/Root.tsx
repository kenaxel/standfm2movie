import React from 'react';
import { Composition } from 'remotion';
import { YouTubeVideo, YouTubeVideoProps } from './compositions/YouTubeVideo';
import { TikTokVideo, TikTokVideoProps } from './compositions/TikTokVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="YouTubeVideo"
        component={YouTubeVideo as any}
        durationInFrames={1800} // 30fps * 60秒 = 1800フレーム
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioUrl: '',
          transcript: [],
          assets: [],
          settings: {
            format: 'youtube' as const,
            duration: 60,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            backgroundColor: '#000000',
            fontFamily: 'Arial',
            fontSize: 48,
            captionStyle: {
              position: 'bottom' as const,
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: '#ffffff',
              fontSize: 48,
              fontFamily: 'Arial',
              fontWeight: 'bold' as const,
              outline: true,
              padding: '12px 20px',
              borderRadius: '8px',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              border: 'none'
            }
          },
          title: ''
        }}
      />
      <Composition
        id="TikTokVideo"
        component={TikTokVideo as any}
        durationInFrames={900} // 30fps * 30秒 = 900フレーム
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioUrl: '',
          transcript: [],
          assets: [],
          settings: {
            format: 'tiktok' as const,
            duration: 30,
            fps: 30,
            resolution: { width: 1080, height: 1920 },
            backgroundColor: '#000000',
            fontFamily: 'Arial',
            fontSize: 64,
            captionStyle: {
              position: 'center' as const,
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: '#ffffff',
              fontSize: 64,
              fontFamily: 'Arial',
              fontWeight: 'bold' as const,
              outline: true,
              padding: '12px 20px',
              borderRadius: '8px',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              border: 'none'
            }
          },
          title: ''
        }}
      />
    </>
  );
};