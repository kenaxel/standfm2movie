'use client'

interface GenerateButtonProps {
  loading: boolean
  disabled: boolean
  onClick: (event?: React.MouseEvent) => void
  currentStep?: 'idle' | 'transcribing' | 'generating' | 'creating-image' | 'creating-video'
  generationType?: 'article' | 'video'
}

const GenerateButton: React.FC<GenerateButtonProps> = ({ loading, disabled, onClick, currentStep = 'idle', generationType = 'article' }) => {
  return (
    <div className="text-center">
      <button
        className={`btn px-8 py-3 ${disabled || loading ? 'btn-disabled' : ''}`}
        onClick={(e) => onClick(e)}
        disabled={disabled || loading}
        type="button"
      >
        {loading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {currentStep === 'transcribing' && '文字起こし中...'}
            {currentStep === 'generating' && (generationType === 'video' ? '動画生成中...' : '記事生成中...')}
            {currentStep === 'creating-image' && '画像生成中...'}
            {currentStep === 'creating-video' && '動画レンダリング中...'}
            {currentStep === 'idle' && '生成中...'}
          </div>
        ) : (
          generationType === 'video' ? '動画を生成する' : '記事を生成する'
        )}
      </button>
      <p className="text-xs text-gray-500 mt-2">
        ※生成には約5分かかります
      </p>
    </div>
  )
}

export default GenerateButton





