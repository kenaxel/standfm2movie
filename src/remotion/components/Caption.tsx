import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { CaptionStyle } from '@/types'

export interface CaptionProps {
  text: string
  style: CaptionStyle
  position: 'top' | 'center' | 'bottom'
  animationType?: 'fade' | 'slide' | 'typewriter' | 'none'
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  style,
  position,
  animationType = 'fade'
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  
  // アニメーション効果
  const getAnimationStyle = () => {
    const animationDuration = 0.5 // 0.5秒でアニメーション
    const animationFrames = fps * animationDuration
    
    switch (animationType) {
      case 'fade':
        const opacity = interpolate(
          frame,
          [0, animationFrames],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        return { opacity }
        
      case 'slide':
        const translateY = interpolate(
          frame,
          [0, animationFrames],
          [50, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        return { transform: `translateY(${translateY}px)`, opacity: 1 }
        
      case 'typewriter':
        const visibleChars = Math.floor(interpolate(
          frame,
          [0, animationFrames * 2],
          [0, text.length],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        ))
        return { opacity: 1, content: text.substring(0, visibleChars) }
        
      default:
        return { opacity: 1 }
    }
  }
  
  const animationStyle = getAnimationStyle()
  const displayText = animationType === 'typewriter' ? animationStyle.content : text
  
  // ベーススタイル定義
  const baseStyle: React.CSSProperties = {
    fontSize: style.fontSize || 24,
    fontFamily: style.fontFamily || 'Arial, sans-serif',
    color: style.color || '#ffffff',
    backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0.7)',
    padding: style.padding || '8px 16px',
    borderRadius: style.borderRadius || '4px',
    textShadow: style.textShadow || '2px 2px 4px rgba(0, 0, 0, 0.8)',
    border: style.border || 'none',
    fontWeight: style.fontWeight || 'normal',
    ...(style.outline && { outline: '2px solid white' })
  }
  
  // ポジション設定
  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return {
          alignItems: 'flex-start',
          paddingTop: '60px'
        }
      case 'center':
        return {
          alignItems: 'center'
        }
      case 'bottom':
      default:
        return {
          alignItems: 'flex-end',
          paddingBottom: '80px'
        }
    }
  }
  
  // テキストを単語単位で分割してハイライト効果を適用
  const renderHighlightedText = (text: string) => {
    if (!style.highlightKeywords || style.highlightKeywords.length === 0) {
      return text
    }
    
    let highlightedText = text
    style.highlightKeywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlightedText = highlightedText.replace(regex, `<span style="color: ${style.highlightColor || '#ffff00'}; font-weight: bold;">$1</span>`)
    })
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
  }
  
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        ...getPositionStyle(),
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          ...baseStyle,
          textAlign: 'center',
          maxWidth: '90%',
          lineHeight: 1.4,
          wordWrap: 'break-word',
          ...animationStyle,
          ...(animationType === 'typewriter' ? {} : { opacity: animationStyle.opacity }),
          ...(animationType === 'slide' ? { transform: animationStyle.transform } : {})
        }}
      >
        {style.highlightKeywords && style.highlightKeywords.length > 0
          ? renderHighlightedText(displayText || '')
          : displayText
        }
      </div>
    </AbsoluteFill>
  )
}

// デフォルトのキャプションスタイル
export const defaultCaptionStyle: CaptionStyle = {
  position: 'bottom',
  fontSize: 32,
  fontFamily: 'Arial, sans-serif',
  color: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  fontWeight: 'normal',
  outline: false,
  padding: '12px 20px',
  borderRadius: '8px',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
  border: 'none'
}