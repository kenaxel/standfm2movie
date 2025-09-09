'use client'

import { useState } from 'react'
import { AssetSearchResult } from '@/types'

const ImageSearchTest: React.FC = () => {
  const [query, setQuery] = useState('')
  const [images, setImages] = useState<AssetSearchResult[]>([])
  const [videos, setVideos] = useState<AssetSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const searchImages = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/search-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          count: 6,
          source: 'both'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '画像検索に失敗しました')
      }
      
      setImages(data.images || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const searchVideos = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/search-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          count: 6,
          orientation: 'landscape'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || '動画検索に失敗しました')
      }
      
      setVideos(data.videos || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">画像・動画検索テスト</h2>
      
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索キーワードを入力"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && searchImages()}
          />
          <button
            onClick={searchImages}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '検索中...' : '画像検索'}
          </button>
          <button
            onClick={searchVideos}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '検索中...' : '動画検索'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-500 text-sm mb-2">
            エラー: {error}
          </div>
        )}
      </div>

      {/* 画像結果 */}
      {images.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">画像検索結果 ({images.length}件)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div key={image.id} className="border rounded-lg overflow-hidden">
                <img
                  src={image.thumbnailUrl}
                  alt={image.description}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">{image.description}</p>
                  <p className="text-xs text-blue-500">{image.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 動画結果 */}
      {videos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">動画検索結果 ({videos.length}件)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div key={video.id} className="border rounded-lg overflow-hidden">
                <img
                  src={video.thumbnailUrl}
                  alt={video.description}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">{video.description}</p>
                  <p className="text-xs text-green-500">{video.source}</p>
                  {video.duration && (
                    <p className="text-xs text-gray-500">{video.duration}秒</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageSearchTest