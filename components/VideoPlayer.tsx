'use client'

import { useState, useRef, useEffect } from 'react'

interface VideoPlayerProps {
  videoUrl: string
  title?: string
  className?: string
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  title = '生成された動画',
  className = '' 
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // 動画URL設定
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    
    console.log('VideoPlayer: 動画URL設定:', videoUrl)
    
    if (videoRef.current) {
      videoRef.current.src = videoUrl
      videoRef.current.load()
    }
  }, [videoUrl])

  const handleLoadStart = () => {
    console.log('動画読み込み開始')
    setIsLoading(true)
    setError(null)
  }

  const handleCanPlay = () => {
    console.log('動画再生準備完了')
    setIsLoading(false)
  }

  const handleLoadedData = () => {
    console.log('動画データ読み込み完了')
    setIsLoading(false)
  }

  const handleError = (e: any) => {
    console.error('動画読み込みエラー:', e)
    setIsLoading(false)
    setError('動画の読み込みに失敗しました')
  }

  const handleDownload = async () => {
    try {
      // 動画ファイルを直接ダウンロード
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('ダウンロードエラー:', error)
      alert('ダウンロードに失敗しました')
    }
  }

  const handleRetry = () => {
    setError(null)
    setIsLoading(true)
    
    if (videoRef.current) {
      const timestamp = Date.now()
      const urlWithCache = videoUrl.includes('?') 
        ? `${videoUrl}&retry=${timestamp}` 
        : `${videoUrl}?retry=${timestamp}`
      
      videoRef.current.src = urlWithCache
      videoRef.current.load()
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        
        <div className="relative bg-black rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
              <div className="flex items-center text-white">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                動画を読み込み中...
              </div>
            </div>
          )}
          
          {error ? (
            <div className="aspect-video flex items-center justify-center bg-gray-100">
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{error}</p>
                <button
                  onClick={handleRetry}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  再試行
                </button>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full aspect-video"
              controls
              preload="auto"
              playsInline
              muted={false}
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onLoadedData={handleLoadedData}
              onError={handleError}
              onLoadedMetadata={() => {
                console.log('動画メタデータ読み込み完了')
                if (videoRef.current) {
                  console.log('動画の長さ:', videoRef.current.duration, '秒')
                  console.log('動画の幅:', videoRef.current.videoWidth)
                  console.log('動画の高さ:', videoRef.current.videoHeight)
                }
                setIsLoading(false)
              }}
            >
              <source src={videoUrl} type="video/mp4" />
              お使いのブラウザは動画の再生をサポートしていません。
            </video>
          )}
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span>形式: MP4</span>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <svg className="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ダウンロード
            </button>
            
            <button
              onClick={() => window.open(videoUrl, '_blank')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              <svg className="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              新しいタブで開く
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
