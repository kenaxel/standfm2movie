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
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string>('')
  
  // videoUrlが変更された時だけ新しいキャッシュバスター付きURLを生成
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    
    // 完全に新しいURLを生成してキャッシュを回避
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const cacheBuster = `cache=${timestamp}-${randomStr}&nocache=true&t=${timestamp}&v=3`;
    
    // URLを完全に新しい形式に変更
    let videoUrlWithCache;
    
    if (videoUrl.includes('/api/video/')) {
      // 既にAPI形式のURLの場合
      videoUrlWithCache = videoUrl.includes('?') 
        ? `${videoUrl}&${cacheBuster}` 
        : `${videoUrl}?${cacheBuster}`;
    } else {
      // 古い形式のURLの場合は新しい形式に変換
      const urlParts = videoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const newBaseUrl = `/api/video/direct/${fileName}`;
      videoUrlWithCache = `${newBaseUrl}?${cacheBuster}`;
    }
    
    console.log('VideoPlayer: 新しいキャッシュバスター付きURL:', videoUrlWithCache);
    setCachedVideoUrl(videoUrlWithCache)
    
    // 既存のビデオ要素を完全にクリア
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.removeAttribute('src');
        
        // すべてのsource要素を削除
        while (videoRef.current.firstChild) {
          videoRef.current.removeChild(videoRef.current.firstChild);
        }
        
        // ブラウザキャッシュをクリアするためのハック
        videoRef.current.innerHTML = '';
        videoRef.current.load();
        
        // メモリ解放を促進
        URL.revokeObjectURL(videoRef.current.src);
      } catch (e) {
        console.error('ビデオ要素のクリア中にエラー:', e);
      }
    }
    
    // より長い遅延を設定して確実にDOMが更新されるようにする
    const timer = setTimeout(() => {
      if (videoRef.current) {
        try {
          // 新しいsource要素を作成
          const source = document.createElement('source');
          source.src = videoUrlWithCache;
          source.type = 'video/mp4';
          
          // 古いsource要素を削除
          while (videoRef.current.firstChild) {
            videoRef.current.removeChild(videoRef.current.firstChild);
          }
          
          // 新しいsource要素を追加
          videoRef.current.appendChild(source);
          
          // 明示的にブラウザに再読み込みを指示
          videoRef.current.load();
          
          console.log('ビデオ要素を再構築しました:', videoUrlWithCache);
          
          // 読み込み後に再生を試みる
          videoRef.current.oncanplay = () => {
            try {
              console.log('ビデオが再生可能になりました');
              videoRef.current?.play().catch(e => console.log('自動再生できませんでした:', e));
            } catch (e) {
              console.log('再生エラー:', e);
            }
          };
          
          // エラーハンドリングを追加
          videoRef.current.onerror = (e) => {
            console.error('ビデオ読み込みエラー:', e);
            setError('動画の読み込みに失敗しました。再読み込みしてください。');
          };
        } catch (e) {
          console.error('ビデオ要素の更新中にエラー:', e);
          setError('動画の設定中にエラーが発生しました');
        }
      }
    }, 500);
    
    return () => {
      clearTimeout(timer);
    };
  }, [videoUrl]) // videoUrlが変わった時だけ実行

  const handleLoadStart = () => {
    setIsLoading(true)
    setError(null)
  }

  const handleCanPlay = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setError('動画の読み込みに失敗しました')
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = `${title}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full aspect-video"
              controls
              preload="auto"
              playsInline
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onError={handleError}
            >
              {/* source要素はJavaScriptで動的に追加 */}
              お使いのブラウザは動画の再生に対応していません。
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
