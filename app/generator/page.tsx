'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'
import SettingsForm from '@/components/SettingsForm'
import GenerateButton from '@/components/GenerateButton'
import ResultPreview from '@/components/ResultPreview'
import MarkdownOutput from '@/components/MarkdownOutput'
import ImageSearchTest from '@/components/ImageSearchTest'
import VideoPlayer from '@/components/VideoPlayer'
import { GenerationSettings, GeneratedContent, VideoSettings, VideoGenerationResult } from '@/types'

export default function GeneratorPage() {
  const [audioSource, setAudioSource] = useState<{ type: 'url' | 'file', source: string | File } | null>(null)
  const [transcript, setTranscript] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [generationType, setGenerationType] = useState<'article' | 'video' | undefined>(undefined)
  const [settings, setSettings] = useState<GenerationSettings>({
    processingMode: 'natural',
    tone: '標準',
    purpose: '集客',
    targetAudience: 'ビジネスに興味あるママ'
  })
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    format: 'youtube',
    duration: 60,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    backgroundColor: '#000000',
    fontFamily: 'Arial',
    fontSize: 32,
    captionStyle: {
      position: 'bottom',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: '#ffffff',
      fontSize: 32,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      outline: false,
      padding: '12px 20px',
      borderRadius: '8px',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
      border: 'none'
    }
  })
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [currentStep, setCurrentStep] = useState<'idle' | 'transcribing' | 'generating' | 'creating-image' | 'creating-video'>('idle')
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [generatedVideo, setGeneratedVideo] = useState<VideoGenerationResult | null>(null)
  const [showMarkdown, setShowMarkdown] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (transcribeOnly = false, event?: React.MouseEvent) => {
    // ページリロードを防ぐ
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    // 重複実行を防ぐ
    if (transcribeOnly && isTranscribing) {
      console.log('文字起こし処理中のため、重複実行をスキップ')
      return
    }
    if (!transcribeOnly && isGenerating) {
      console.log('生成処理中のため、重複実行をスキップ')
      return
    }
    
    if (!transcribeOnly && !generationType) {
      setError('生成タイプを選択してください')
      return
    }

    if (transcribeOnly) {
      setIsTranscribing(true)
      setTranscriptError(null)
      setTranscript('')
    } else {
      setIsGenerating(true)
      setError(null)
      setGeneratedContent(null)
      setGeneratedVideo(null)
    }

    let currentTranscript = transcript

    // 文字起こしのみの場合のみ実行（記事/動画生成時は既存の文字起こし結果を使用）
    if (transcribeOnly && !currentTranscript) {
      if (!audioSource) {
        const errorMsg = '音声ファイルまたはURLを選択してください'
        if (transcribeOnly) {
          setTranscriptError(errorMsg)
          setIsTranscribing(false)
        } else {
          setError(errorMsg)
          setIsGenerating(false)
        }
        return
      }
      
      try {
        setCurrentStep('transcribing')
        let transcriptResult
        
        if (audioSource.type === 'url') {
          transcriptResult = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: audioSource.source })
          }).then(res => res.json())
        } else {
          const formData = new FormData()
          formData.append('file', audioSource.source as File)
          transcriptResult = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          }).then(res => res.json())
        }

        if (transcriptResult.error) {
          throw new Error(transcriptResult.error)
        }

        currentTranscript = transcriptResult.transcript
        setTranscript(currentTranscript)
      } catch (err: any) {
        const errorMsg = err.message || '文字起こしでエラーが発生しました'
        if (transcribeOnly) {
          setTranscriptError(errorMsg)
          setIsTranscribing(false)
        } else {
          setError(errorMsg)
          setIsGenerating(false)
        }
        setCurrentStep('idle')
        return
      }
    }

    // 文字起こしのみの場合はここで終了
    if (transcribeOnly) {
      setIsTranscribing(false)
      setCurrentStep('idle')
      return
    }

    // 記事/動画生成時に文字起こし結果がない場合はエラー
    if (!currentTranscript) {
      setError('先に文字起こしを実行してください')
      setIsGenerating(false)
      return
    }

    try {
      if (generationType === 'video') {
        // 動画生成（既存の文字起こし結果を使用）
        setCurrentStep('creating-video')
        
        // 音声ファイルをBase64に変換（ファイルの場合）
        let audioInputForVideo: any = null
    
        // 毎回新しい音声入力オブジェクトを作成してキャッシュを回避
        if (audioSource && audioSource.type === 'file' && audioSource.source instanceof File) {
          const file = audioSource.source as File
          
          // FormDataを使用して直接ファイルを送信する準備
          const formData = new FormData()
          formData.append('audioFile', file)
          
          // 一時的にファイルをアップロードして処理
          console.log('音声ファイルを一時アップロード中...')
          const uploadResponse = await fetch('/api/upload-temp-audio', {
            method: 'POST',
            body: formData
          })
          
          if (!uploadResponse.ok) {
            throw new Error('音声ファイルのアップロードに失敗しました')
          }
          
          const uploadResult = await uploadResponse.json()
          
          audioInputForVideo = {
            type: 'tempFile',
            path: uploadResult.filePath,
            originalName: file.name,
            format: file.name.split('.').pop() || 'mp3',
            size: file.size,
            uniqueId: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
            timestamp: Date.now()
          }
        } else if (audioSource && audioSource.type === 'url') {
          // URLの場合、サーバー側でダウンロードして処理するように変更
          const sourceUrl = audioSource.source;
          
          console.log('音声URLを処理中...')
          const downloadResponse = await fetch('/api/download-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              url: sourceUrl,
              uniqueId: `${Date.now()}-${Math.random().toString(36).substring(2)}`
            })
          })
          
          if (!downloadResponse.ok) {
            throw new Error('音声URLの処理に失敗しました')
          }
          
          const downloadResult = await downloadResponse.json()
          
          audioInputForVideo = {
            type: 'tempFile',
            path: downloadResult.filePath,
            originalUrl: sourceUrl,
            uniqueId: downloadResult.uniqueId,
            timestamp: Date.now()
          }
        } else {
          audioInputForVideo = {
            ...audioSource,
            uniqueId: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
            timestamp: Date.now()
          }
        }
        
        // 文字起こしを適切なセグメントに分割
        const segmentLength = 5; // 5秒ごとにセグメント分割（より細かく）
        const transcriptSegments = [];
        
        // 文字起こしテキストを文単位で分割
        const sentences = currentTranscript.split(/[。.!?！？]/g).filter(s => s.trim().length > 0);
        
        // 各文に対して適切な時間を割り当て
        const totalDuration = videoSettings.duration;
        const avgTimePerSentence = totalDuration / sentences.length;
        
        let currentTime = 0;
        for (let i = 0; i < sentences.length; i++) {
          // 文の長さに応じて時間を調整（長い文はより長い時間）
          const sentenceLength = sentences[i].length;
          const sentenceDuration = Math.max(
            2, // 最低2秒
            Math.min(
              10, // 最大10秒
              avgTimePerSentence * (sentenceLength / 20) // 文字数に応じて調整
            )
          );
          
          const startTime = currentTime;
          const endTime = Math.min(startTime + sentenceDuration, totalDuration);
          
          transcriptSegments.push({
            text: sentences[i].trim(),
            startTime,
            endTime,
            keywords: extractKeywords(sentences[i]) // キーワード抽出
          });
          
          currentTime = endTime;
        }
        
        // 最後のセグメントが動画の長さに達していない場合は調整
        if (transcriptSegments.length > 0 && transcriptSegments[transcriptSegments.length - 1].endTime < totalDuration) {
          transcriptSegments[transcriptSegments.length - 1].endTime = totalDuration;
        }
        
        // キーワード抽出関数
        function extractKeywords(text) {
          // 簡易的なキーワード抽出（実際はもっと洗練された方法を使うべき）
          const stopWords = ['は', 'が', 'の', 'に', 'を', 'と', 'です', 'ます', 'した', 'から', 'など', 'これ', 'それ', 'あれ'];
          const words = text.split(/\s+/);
          return words
            .filter(word => word.length > 1 && !stopWords.includes(word))
            .slice(0, 5); // 最大5つのキーワード
        }
        
        console.log('生成する字幕セグメント:', transcriptSegments);
        
        const uniqueCacheBreaker = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        
        // 関連キーワードを抽出（全体から）
        const allKeywords = extractMainKeywords(currentTranscript);
        console.log('抽出された主要キーワード:', allKeywords);
        
        // 新しいジョブIDを生成
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        console.log(`動画生成ジョブを開始: ${jobId}`);
        
        // 動画生成リクエストを送信
        const videoResponse = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            audioInput: audioInputForVideo,
            settings: videoSettings,
            transcript: transcriptSegments,
            keywords: allKeywords,
            contentType: detectContentType(currentTranscript),
            cacheBreaker: uniqueCacheBreaker,
            forceRefresh: true,
            timestamp: Date.now(),
            preventCache: Math.random().toString(36).substring(2),
            // 追加のメタデータ
            meta: {
              clientTimestamp: Date.now(),
              clientId: `client-${Math.random().toString(36).substring(2)}`,
              sessionId: `session-${Math.random().toString(36).substring(2)}`
            }
          })
        })
        
        // 主要キーワードを抽出する関数
        function extractMainKeywords(text) {
          // 頻出単語を抽出
          const words = text.split(/[\s,。.!?！？]/);
          const wordCount = {};
          
          // 単語の出現回数をカウント
          words.forEach(word => {
            if (word.length > 1) {
              wordCount[word] = (wordCount[word] || 0) + 1;
            }
          });
          
          // 出現回数でソートして上位を取得
          return Object.entries(wordCount)
            .filter(([word]) => word.length > 1 && !/^[a-zA-Z0-9]+$/.test(word)) // 日本語の単語を優先
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
        }
        
        // コンテンツタイプを検出する関数
        function detectContentType(text) {
          const techKeywords = ['プログラミング', 'コード', 'アプリ', 'ソフトウェア', 'エンジニア', 'デベロッパー', 'コンピューター'];
          const businessKeywords = ['ビジネス', '経営', '起業', '投資', '営業', 'マーケティング'];
          const lifestyleKeywords = ['生活', '健康', '料理', '旅行', 'ファッション'];
          
          let techScore = 0;
          let businessScore = 0;
          let lifestyleScore = 0;
          
          techKeywords.forEach(keyword => {
            if (text.includes(keyword)) techScore += 1;
          });
          
          businessKeywords.forEach(keyword => {
            if (text.includes(keyword)) businessScore += 1;
          });
          
          lifestyleKeywords.forEach(keyword => {
            if (text.includes(keyword)) lifestyleScore += 1;
          });
          
          if (techScore > businessScore && techScore > lifestyleScore) {
            return 'technology';
          } else if (businessScore > techScore && businessScore > lifestyleScore) {
            return 'business';
          } else if (lifestyleScore > techScore && lifestyleScore > businessScore) {
            return 'lifestyle';
          } else {
            return 'general';
          }
        }
        
        if (!videoResponse.ok) {
          const errorText = await videoResponse.text()
          console.error('動画生成エラー:', errorText)
          throw new Error(`動画生成に失敗しました (${videoResponse.status}): ${errorText}`)
        }
        
        const videoResult = await videoResponse.json()
        
        if (videoResult.error) {
          throw new Error(videoResult.error)
        }

        // 動画URLにタイムスタンプパラメータを追加してキャッシュを回避
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 15)
        
        // 動画URLを完全に新しい形式に変更
        const newVideoUrl = `/api/video/${jobId}/output.mp4?t=${timestamp}&cache=${randomStr}&nocache=true&v=2`;
        
        const resultWithTimestamp = {
          ...videoResult.result,
          videoUrl: newVideoUrl,
          jobId: jobId
        }
        
        console.log('新しい動画URL:', newVideoUrl)
        
        // 古い動画の状態をクリアしてから新しい動画を設定
        setGeneratedVideo(null)
        
        // 少し待ってから新しい動画を設定（DOMの更新を確実にするため）
        setTimeout(() => {
          setGeneratedVideo(resultWithTimestamp)
        }, 500)
        
        // さらに遅延させて動画要素を強制的に更新
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.load();
          }
        }, 1000)
      } else {
        // 記事生成（既存の文字起こし結果を使用）
        console.log('記事生成開始:', { transcript: currentTranscript.substring(0, 100) + '...', settings })
        setCurrentStep('generating')
        
        const articleResponse = await fetch('/api/generate-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: currentTranscript,
            settings
          })
        })
        
        console.log('記事生成レスポンス:', articleResponse.status, articleResponse.statusText)
        
        if (!articleResponse.ok) {
          const errorText = await articleResponse.text()
          console.error('記事生成エラー:', errorText)
          throw new Error(`記事生成に失敗しました (${articleResponse.status}): ${errorText}`)
        }
        
        const articleResult = await articleResponse.json()
        console.log('記事生成結果:', articleResult)

        if (articleResult.error) {
          console.error('記事生成APIエラー:', articleResult.error)
          throw new Error(articleResult.error)
        }

        // 画像生成
        console.log('画像生成開始:', { title: articleResult.seoTitle, tone: settings.tone, purpose: settings.purpose })
        setCurrentStep('creating-image')
        
        const imageResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: articleResult.seoTitle,
            tone: settings.tone,
            purpose: settings.purpose
          })
        })
        
        console.log('画像生成レスポンス:', imageResponse.status, imageResponse.statusText)
        
        if (!imageResponse.ok) {
          const errorText = await imageResponse.text()
          console.error('画像生成エラー:', errorText)
          throw new Error(`画像生成に失敗しました (${imageResponse.status}): ${errorText}`)
        }
        
        const imageResult = await imageResponse.json()
        console.log('画像生成結果:', imageResult)

        if (imageResult.error) {
          console.error('画像生成APIエラー:', imageResult.error)
          throw new Error(imageResult.error)
        }

        // 結果を設定
        const finalContent = {
          ...articleResult,
          coverImageUrl: imageResult.imageUrl
        }
        console.log('最終結果設定:', finalContent)
        setGeneratedContent(finalContent)
      }
    } catch (err: any) {
      console.error('生成処理エラー:', err)
      const errorMessage = err.message || 'エラーが発生しました'
      console.error('エラーメッセージ:', errorMessage)
      setError(errorMessage)
    } finally {
      console.log('生成処理完了 - 状態をリセット')
      setIsGenerating(false)
      setCurrentStep('idle')
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      {/* ヘッダー */}
      <header className="text-center mb-8">
        <h1>スタエフ→note記事＋動画自動生成ツール</h1>
        <p className="text-lg text-gray-600">音声から記事や動画を自動生成！</p>
      </header>

      {/* ステップ1: 音声アップロード */}
      <section className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">ステップ1: 音声をアップロード</h2>
        <AudioUpload 
          onFileSelect={(file) => {
              setAudioSource({ type: 'file', source: file })
              // 新しい音声ファイルが選択された時に古いデータをクリア
              setTranscript('')
              setGeneratedContent(null)
              setGeneratedVideo(null)
              setError(null)
              setTranscriptError(null)
            }}
            onUrlInput={(url) => {
              setAudioSource({ type: 'url', source: url })
              // 新しい音声URLが入力された時に古いデータをクリア
              setTranscript('')
              setGeneratedContent(null)
              setGeneratedVideo(null)
              setError(null)
              setTranscriptError(null)
            }}
        />
        
        {audioSource && (
          <div className="mt-6">
            <button
              onClick={(e) => handleGenerate(true, e)}
              disabled={isTranscribing}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              type="button"
            >
              {isTranscribing ? '文字起こし中...' : '文字起こしを開始'}
            </button>
          </div>
        )}
        
        {transcriptError && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
            {transcriptError}
          </div>
        )}
      </section>

      {/* ステップ2: 文字起こし結果の表示・編集 */}
      {transcript && (
        <section className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">ステップ2: 文字起こし結果の確認・編集</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">文字起こし結果（編集可能）</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-40 p-3 border rounded-md resize-vertical"
              placeholder="文字起こし結果がここに表示されます..."
            />
          </div>
        </section>
      )}

      {/* ステップ3: 生成タイプ選択 */}
      {transcript && (
        <section className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">ステップ3: 生成タイプを選択</h2>
          <div className="flex gap-4 mb-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="generationType"
                value="article"
                checked={generationType === 'article'}
                onChange={(e) => setGenerationType(e.target.value as 'article' | 'video')}
                className="mr-2"
              />
              note記事生成
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="generationType"
                value="video"
                checked={generationType === 'video'}
                onChange={(e) => setGenerationType(e.target.value as 'article' | 'video')}
                className="mr-2"
              />
              動画生成
            </label>
          </div>

          {generationType === 'article' ? (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">記事設定</h3>
              <SettingsForm
                settings={settings}
                onChange={setSettings}
              />
            </div>
          ) : generationType === 'video' ? (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">動画設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">フォーマット</label>
                  <select
                    value={videoSettings.format}
                    onChange={(e) => setVideoSettings(prev => ({ ...prev, format: e.target.value as 'youtube' | 'tiktok' }))}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="youtube">YouTube (横型)</option>
                    <option value="tiktok">TikTok (縦型)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">動画の長さ (秒)</label>
                  <input
                    type="number"
                    value={videoSettings.duration}
                    onChange={(e) => setVideoSettings(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full p-2 border rounded-md"
                    min="10"
                    max="300"
                  />
                </div>
              </div>
            </div>
          ) : null}
          
          {generationType && (
            <div className="mt-6">
              <GenerateButton 
                loading={isGenerating}
                disabled={!transcript || !generationType}
                onClick={(event) => handleGenerate(false, event)}
                currentStep={currentStep}
                generationType={generationType}
              />
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </section>
      )}

      {/* 結果表示 */}
      {generatedContent && (
        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2>生成結果</h2>
            <div>
              <button 
                className="mr-2 px-3 py-1 text-sm border rounded-md"
                onClick={() => setShowMarkdown(!showMarkdown)}
              >
                {showMarkdown ? 'プレビュー表示' : 'Markdown表示'}
              </button>
            </div>
          </div>
          
          {showMarkdown ? (
            <MarkdownOutput content={generatedContent} />
          ) : (
            <ResultPreview content={generatedContent} transcript={transcript} />
          )}
        </section>
      )}

      {/* 動画結果表示 */}
      {generatedVideo && (
        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2>動画生成結果</h2>
            <div>
              {generatedVideo.videoUrl.startsWith('data:') ? (
                <a 
                  href={generatedVideo.videoUrl}
                  download={`generated-video-${Date.now()}.mp4`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  動画をダウンロード
                </a>
              ) : (
                <button 
                  onClick={() => alert('デモモードでは動画のダウンロードはできません。実際のAPIキーを設定すると、生成された動画をダウンロードできます。')}
                  className="px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
                  disabled
                >
                  動画をダウンロード
                </button>
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 動画プレビュー */}
              <div>
                <VideoPlayer 
                  videoUrl={generatedVideo.videoUrl}
                  title="生成された動画"
                  className="w-full"
                />
              </div>
              
              {/* 動画情報 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">動画情報</h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium">フォーマット:</span>
                    <span className="ml-2">{videoSettings.format === 'youtube' ? 'YouTube (横型)' : 'TikTok (縦型)'}</span>
                  </div>
                  <div>
                    <span className="font-medium">解像度:</span>
                    <span className="ml-2">{videoSettings.resolution.width} × {videoSettings.resolution.height}</span>
                  </div>
                  <div>
                    <span className="font-medium">長さ:</span>
                    <span className="ml-2">{Math.floor(generatedVideo.duration / 60)}分{generatedVideo.duration % 60}秒</span>
                  </div>
                  <div>
                    <span className="font-medium">ファイルサイズ:</span>
                    <span className="ml-2">{(generatedVideo.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                </div>
                
                {/* 文字起こしテキスト */}
                {transcript && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">音声テキスト</h4>
                    <div className="p-3 bg-gray-50 rounded-md text-sm max-h-32 overflow-y-auto">
                      {transcript}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* API テストセクション */}
      <section className="mb-8">
        <ImageSearchTest />
      </section>
    </main>
  )
}
