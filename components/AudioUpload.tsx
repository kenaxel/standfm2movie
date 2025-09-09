'use client'

import { useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface AudioUploadProps {
  onFileSelect: (file: File) => void
  onUrlInput: (url: string) => void
  maxSize?: number
  acceptedFormats?: string[]
}

const AudioUpload: React.FC<AudioUploadProps> = ({
  onFileSelect,
  onUrlInput,
  maxSize = 25 * 1024 * 1024, // 25MB
  acceptedFormats = ['audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/wav', 'audio/mp4', 'video/mp4', 'audio/flac', 'audio/ogg', 'audio/oga', 'audio/webm', 'video/webm', 'audio/mpga']
}) => {
  const [url, setUrl] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file')
  const [error, setError] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptedFormats.reduce((acc, format) => {
      acc[format] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setError(null)
        onFileSelect(acceptedFiles[0])
      }
    },
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0]
      if (rejection.errors[0].code === 'file-too-large') {
        setError(`ファイルサイズが大きすぎます。最大${Math.round(maxSize / (1024 * 1024))}MBまで対応しています。`)
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setError('対応していないファイル形式です。mp3, m4a, wav, mp4, flac, ogg, webmファイルをアップロードしてください。')
      } else {
        setError('ファイルのアップロードに失敗しました。')
      }
    }
  })

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('URLを入力してください。')
      return
    }
    
    // 簡易的なURL検証
    try {
      new URL(url)
      setError(null)
      onUrlInput(url)
    } catch (err) {
      setError('有効なURLを入力してください。')
    }
  }

  return (
    <div>
      <h3>音声入力</h3>
      
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 ${activeTab === 'file' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('file')}
        >
          ファイルアップロード
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'url' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('url')}
        >
          URL入力
        </button>
      </div>
      
      {activeTab === 'file' ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>ここにファイルをドロップ...</p>
          ) : (
            <div>
              <p className="mb-2">クリックまたはドラッグ＆ドロップでファイルをアップロード</p>
              <p className="text-sm text-gray-500">対応形式: mp3, m4a, wav, mp4, flac, ogg, webm (最大60分, 25MB)</p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleUrlSubmit}>
          <div className="flex">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="音声ファイルのURL（stand.fmなど）"
              className="input flex-grow"
            />
            <button type="submit" className="btn ml-2">
              取得
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            stand.fmのURLを入力すると音声を取得できます
          </p>
        </form>
      )}
      
      {error && (
        <div className="mt-2 text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

export default AudioUpload

