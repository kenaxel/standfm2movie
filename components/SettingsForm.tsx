'use client'

import { GenerationSettings } from '@/types'

interface SettingsFormProps {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
}

const SettingsForm: React.FC<SettingsFormProps> = ({ settings, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    onChange({
      ...settings,
      [name]: value
    })
  }

  return (
    <div>
      <h3>記事設定</h3>
      
      <div className="mb-6">
        <label htmlFor="processingMode" className="block mb-2 text-sm font-medium">
          処理モード
        </label>
        <select
          id="processingMode"
          name="processingMode"
          value={settings.processingMode}
          onChange={handleChange}
          className="select w-full"
        >
          <option value="natural">A: 話を自然な文体にするだけ</option>
          <option value="article">B: 記事として構成する</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {settings.processingMode === 'natural' 
            ? '文字起こしを自然な文体に整えるだけの簡単な処理です'
            : '記事として構成し、SEOタイトルやCTAなども生成します'
          }
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tone" className="block mb-1 text-sm font-medium">
            口調
          </label>
          <select
            id="tone"
            name="tone"
            value={settings.tone}
            onChange={handleChange}
            className="select"
          >
            <option value="標準">標準</option>
            <option value="大阪弁">大阪弁</option>
            <option value="丁寧">丁寧</option>
          </select>
        </div>
        

      </div>
    </div>
  )
}

export default SettingsForm





