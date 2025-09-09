import React from 'react'
import {
  AbsoluteFill,
  Img,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing
} from 'remotion'
import { VideoAsset, VideoSettings } from '@/types'

export interface BackgroundMediaProps {
  asset: VideoAsset
  settings: VideoSettings
  transitionType?: 'fade' | 'slide' | 'zoom' | 'none'
  blur?: number
  opacity?: number
}

export const BackgroundMedia: React.FC<BackgroundMediaProps> = ({
  asset,
  settings,
  transitionType = 'fade',
  blur = 0,
  opacity = 1
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  
  // トランジション効果
  const getTransitionStyle = () => {
    const transitionDuration = 1 // 1秒でトランジション
    const transitionFrames = fps * transitionDuration
    
    switch (transitionType) {
      case 'fade':
        const fadeOpacity = interpolate(
          frame,
          [0, transitionFrames],
          [0, opacity],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
          }
        )
        return { opacity: fadeOpacity }
        
      case 'slide':
        const slideX = interpolate(
          frame,
          [0, transitionFrames],
          [width, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.quad)
          }
        )
        return { transform: `translateX(${slideX}px)`, opacity }
        
      case 'zoom':
        const zoomScale = interpolate(
          frame,
          [0, transitionFrames],
          [1.2, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.quad)
          }
        )
        return { transform: `scale(${zoomScale})`, opacity }
        
      default:
        return { opacity }
    }
  }
  
  const transitionStyle = getTransitionStyle()
  
  // アスペクト比を維持しながらフィット
  const getMediaStyle = () => {
    const baseStyle = {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      filter: blur > 0 ? `blur(${blur}px)` : 'none',
      ...transitionStyle
    }
    
    // 解像度に応じてスケーリング調整
    if (settings.format === 'tiktok') {
      // 縦型動画の場合、横幅を基準にスケーリング
      return {
        ...baseStyle,
        objectPosition: 'center center'
      }
    } else {
      // 横型動画の場合、標準的なフィット
      return {
        ...baseStyle,
        objectPosition: 'center center'
      }
    }
  }
  
  const mediaStyle = getMediaStyle()
  
  // Ken Burns効果（ゆっくりとしたズーム・パン）
  const kenBurnsEffect = () => {
    const effectDuration = 10 // 10秒でエフェクト完了
    const effectFrames = fps * effectDuration
    
    const scale = interpolate(
      frame % effectFrames,
      [0, effectFrames],
      [1, 1.1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.quad)
      }
    )
    
    const translateX = interpolate(
      frame % effectFrames,
      [0, effectFrames],
      [0, -20],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.quad)
      }
    )
    
    return {
      transform: `scale(${scale}) translateX(${translateX}px)`,
      transformOrigin: 'center center'
    }
  }
  
  return (
    <AbsoluteFill>
      {/* 背景のグラデーション（フォールバック） */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${settings.backgroundColor}cc, ${settings.backgroundColor}88)`
        }}
      />
      
      {/* メインメディア */}
      <div style={kenBurnsEffect()}>
        {asset.type === 'video' ? (
          <Video
            src={asset.url}
            style={mediaStyle}
            muted
            loop
            playsInline
          />
        ) : (
          <Img
            src={asset.url}
            style={mediaStyle}
          />
        )}
      </div>
      
      {/* オーバーレイ効果 */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)',
          mixBlendMode: 'multiply'
        }}
      />
    </AbsoluteFill>
  )
}

// プリセット効果
export const BackgroundMediaPresets = {
  subtle: {
    transitionType: 'fade' as const,
    blur: 0,
    opacity: 0.8
  },
  dramatic: {
    transitionType: 'zoom' as const,
    blur: 2,
    opacity: 0.9
  },
  minimal: {
    transitionType: 'none' as const,
    blur: 5,
    opacity: 0.6
  }
}