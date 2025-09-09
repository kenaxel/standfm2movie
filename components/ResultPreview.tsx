'use client'

import Image from 'next/image'
import { GeneratedContent } from '@/types'

interface ResultPreviewProps {
  content: GeneratedContent
  transcript?: string
}

const ResultPreview: React.FC<ResultPreviewProps> = ({ content, transcript }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(content.markdown)
    alert('Markdownをクリップボードにコピーしました！')
  }

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold">{content.seoTitle}</h2>
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm"
        >
          Markdownをコピー
        </button>
      </div>

      {transcript && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-3">文字起こし結果</h3>
          <div className="text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {transcript}
          </div>
        </div>
      )}

      {content.coverImageUrl && (
        <div className="relative w-full h-64 mb-6">
          <Image
            src={content.coverImageUrl}
            alt={content.seoTitle}
            fill
            style={{ objectFit: 'cover' }}
            className="rounded-lg"
          />
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">リード文</h3>
        <p className="text-gray-700">{content.leadText}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">本文</h3>
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: content.content
              .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
              .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium mt-4 mb-2">$1</h3>')
              .replace(/\n\n/g, '<br/><br/>') 
          }} 
        />
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">CTA</h3>
        <p className="text-gray-700">{content.cta}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">メタディスクリプション</h3>
        <p className="text-gray-700">{content.metaDescription}</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">タグ</h3>
        <div className="flex flex-wrap gap-2">
          {content.tags.map((tag, index) => (
            <span key={index} className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-sm">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ResultPreview





