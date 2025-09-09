import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing
} from 'remotion'
import { VideoSettings, TranscriptSegment, VideoAsset } from '@/types'
import { Caption } from '../components/Caption'
import { BackgroundMedia } from '../components/BackgroundMedia'

export interface TikTokVideoProps {
  audioUrl: string
  transcript: TranscriptSegment[]
  assets: VideoAsset[]
  settings: VideoSettings
  title?: string
}

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  audioUrl,
  transcript,
  assets,
  settings,
  title
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const currentTime = frame / fps

  // タイトル表示の制御（最初の2秒間、TikTokは短め）
  const showTitle = currentTime < 2
  const titleOpacity = interpolate(
    frame,
    [0, fps * 0.3, fps * 1.7, fps * 2],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    }
  )

  // 現在のキャプションを取得
  const currentCaption = transcript.find(
    segment => currentTime >= segment.startTime && currentTime <= segment.endTime
  )

  // 現在の背景アセットを取得（TikTokは短いので5秒ごとに切り替え）
  const getCurrentAsset = (): VideoAsset | undefined => {
    const assetIndex = Math.floor(currentTime / 5) % assets.length
    return assets[assetIndex]
  }

  const currentAsset = getCurrentAsset()

  // TikTok風のズーム効果
  const zoomScale = interpolate(
    frame % (fps * 10), // 10秒ごとにリセット
    [0, fps * 10],
    [1, 1.1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad)
    }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: settings.backgroundColor || '#000000' }}>
      {/* 音声トラック */}
      <Audio src={audioUrl} />
      
      {/* 背景メディア（ズーム効果付き） */}
      {currentAsset && (
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center' }}>
          <BackgroundMedia
            asset={currentAsset}
            settings={settings}
          />
        </div>
      )}
      
      {/* TikTok風のグラデーションオーバーレイ */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(45deg, rgba(255,0,150,0.1) 0%, rgba(0,255,255,0.1) 100%)'
        }}
      />
      
      {/* タイトル表示（縦型レイアウト用） */}
      {showTitle && title && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: titleOpacity
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: '#ffffff',
              textAlign: 'center',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              padding: '15px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '15px',
              maxWidth: '90%',
              border: '2px solid rgba(255,255,255,0.3)'
            }}
          >
            {title}
          </div>
        </AbsoluteFill>
      )}
      
      {/* キャプション（TikTok風のスタイル） */}
      {currentCaption && (
        <Caption
          text={currentCaption.text}
          style={{
            ...settings.captionStyle,
            fontSize: settings.captionStyle.fontSize * 1.2, // TikTokは大きめ
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: '25px',
            padding: '12px 20px'
          }}
          position="bottom"
        />
      )}
      
      {/* TikTok風のサイドUI要素 */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: '20px',
          flexDirection: 'column',
          gap: '15px'
        }}
      >
        {/* いいねボタン風 */}
        <div
          style={{
            width: '50px',
            height: '50px',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}
        >
          ❤️
        </div>
        
        {/* シェアボタン風 */}
        <div
          style={{
            width: '50px',
            height: '50px',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}
        >
          📤
        </div>
      </AbsoluteFill>
      
      {/* ブランディング（左下角） */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: '20px'
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '6px 10px',
            borderRadius: '15px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          @StandFM2Movie
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}