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
    
    // キャッシュバスターを追加
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const cacheBuster = `t=${timestamp}&cache=${randomStr}`;
    
    // URLにキャッシュバスターを追加
    const videoUrlWithCache = videoUrl.includes('?') 
      ? `${videoUrl}&${cacheBuster}` 
      : `${videoUrl}?${cacheBuster}`;
    
    console.log('VideoPlayer: 動画URL:', videoUrlWithCache);
    setCachedVideoUrl(videoUrlWithCache)
    
    // 読み込みタイムアウトを設定
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('動画読み込みタイムアウト');
        setError('動画の読み込みに時間がかかっています。ファイルが存在しない可能性があります。');
        setIsLoading(false);
      }
    }, 10000); // 10秒後にタイムアウト
    
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
        if (videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src);
        }
        
        // 明示的にブラウザにキャッシュをクリアするよう指示
        const head = document.getElementsByTagName('head')[0];
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Cache-Control';
        meta.content = 'no-cache, no-store, must-revalidate';
        head.appendChild(meta);
        setTimeout(() => head.removeChild(meta), 100);
      } catch (e) {
        console.error('ビデオ要素のクリア中にエラー:', e);
      }
    }
    
    // 遅延実行して確実に処理
    const timer = setTimeout(() => {
      try {
        if (videoRef.current) {
          // video要素に直接srcを設定（source要素を使わない）
          videoRef.current.src = videoUrlWithCache;
          
          // 明示的にブラウザに再読み込みを指示
          videoRef.current.load();
          
          console.log('ビデオ要素を再構築しました:', videoUrlWithCache);
          
          // 読み込み後に再生を試みる
          videoRef.current.oncanplay = () => {
            try {
              console.log('ビデオが再生可能になりました');
              setIsLoading(false);
              videoRef.current?.play().catch(e => console.log('自動再生できませんでした:', e));
            } catch (e) {
              console.log('再生エラー:', e);
            }
          };
          
          // エラーハンドリングを追加
          videoRef.current.onerror = (e) => {
            console.error('ビデオ読み込みエラー:', e);
            setError('動画の読み込みに失敗しました。再読み込みしてください。');
            setIsLoading(false);
            
            // エラーの詳細をログに出力
            if (videoRef.current && videoRef.current.error) {
              console.error('エラーコード:', videoRef.current.error.code);
              console.error('エラーメッセージ:', videoRef.current.error.message);
              
              // 特定のエラーコードに対する処理
              if (videoRef.current.error.code === 4) {
                console.log('MEDIA_ERR_SRC_NOT_SUPPORTED: ソースがサポートされていません');
                // 別の方法で動画を読み込む
                const alternativeUrl = videoUrl.replace('/output/', '/api/video/direct/');
                videoRef.current.src = alternativeUrl + `?${cacheBuster}`;
                videoRef.current.load();
              }
            }
          };
          
          // 読み込みタイムアウトを追加
          videoRef.current.onloadedmetadata = () => {
            console.log('動画のメタデータが読み込まれました');
            setIsLoading(false);
          };
        }
      } catch (e) {
        console.error('ビデオ要素の更新中にエラー:', e);
        setError('動画の設定中にエラーが発生しました');
        setIsLoading(false);
      }
    }, 300);
    
    // 読み込み失敗時のバックアップタイマー
    const backupTimer = setTimeout(() => {
      if (isLoading) {
        console.log('動画読み込みタイムアウト（内部）');
        setIsLoading(false);
      }
    }, 5000); // 5秒後のタイムアウト
    
    return () => {
      clearTimeout(backupTimer);
      clearTimeout(loadingTimeout);
      clearTimeout(timer);
    };
  }, [videoUrl]) // videoUrlが変わった時だけ実行

  const handleLoadStart = () => {
    setIsLoading(true)
    setError(null)
  }

  const handleCanPlay = () => {
    console.log('動画の再生準備ができました');
    setIsLoading(false);
  }

  const handleError = (e: any) => {
    console.error('動画読み込みエラー:', e);
    setIsLoading(false);
    
    // エラーの詳細をログに出力
    if (videoRef.current && videoRef.current.error) {
      const errorCode = videoRef.current.error.code;
      const errorMessage = videoRef.current.error.message;
      console.error('ビデオエラーコード:', errorCode);
      console.error('ビデオエラーメッセージ:', errorMessage);
      
      // エラーコードに応じたメッセージを表示
      switch (errorCode) {
        case 1: // MEDIA_ERR_ABORTED
          setError('動画の読み込みが中断されました。');
          break;
        case 2: // MEDIA_ERR_NETWORK
          setError('ネットワークエラーが発生しました。');
          break;
        case 3: // MEDIA_ERR_DECODE
          setError('動画ファイルの形式に問題があります。');
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          setError('動画ファイルが見つからないか、サポートされていない形式です。');
          break;
        default:
          setError('動画の読み込みに失敗しました。ファイルが存在しない可能性があります。');
      }
    } else {
      setError('動画の読み込みに失敗しました。ファイルが存在しない可能性があります。');
    }
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
                <button
                  onClick={() => {
                    setError(null)
                    setIsLoading(true)
                    // 動画URLを再試行
                    const timestamp = Date.now()
                    const newUrl = videoUrl.split('?')[0] + `?retry=${timestamp}`
                    setCachedVideoUrl(newUrl)
                  }}
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
              src={cachedVideoUrl}
              type="video/mp4"
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onError={handleError}
              onStalled={() => console.log('動画の読み込みが停止しました')}
              onSuspend={() => console.log('動画の読み込みが中断されました')}
              onWaiting={() => console.log('動画がデータを待機中です')}
              onAbort={() => console.log('動画の読み込みが中止されました')}
            />
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
