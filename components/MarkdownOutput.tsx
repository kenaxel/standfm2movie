'use client'

import { GeneratedContent } from '@/types'

interface MarkdownOutputProps {
  content: GeneratedContent
}

const MarkdownOutput: React.FC<MarkdownOutputProps> = ({ content }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(content.markdown)
    alert('Markdownをクリップボードにコピーしました！')
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3>Markdown出力</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm"
        >
          コピー
        </button>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md overflow-auto">
        <pre className="whitespace-pre-wrap text-sm font-mono">
          {content.markdown}
        </pre>
      </div>
      
      <p className="mt-4 text-sm text-gray-600">
        このMarkdownをnoteに直接貼り付けることができます。
      </p>
    </div>
  )
}

export default MarkdownOutput





