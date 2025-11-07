import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, X, FileText, Image, File, Loader2, CheckCircle } from 'lucide-react'
import FeaturesDropdown from './FeaturesDropdown'

/**
 * Premium ChatInput Component with Upload and Features
 * 
 * @param {Object} props
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Input change handler
 * @param {Function} props.onSubmit - Submit handler
 * @param {Function} props.onUpload - Upload handler (file) => {document_id, filepath}
 * @param {Function} props.onRunOCR - OCR handler (document_id) => void
 * @param {Object} props.features - Current feature states
 * @param {Function} props.onFeatureChange - Feature change handler
 * @param {boolean} props.disabled - Disable input
 */
const ChatInput = ({
  value = '',
  onChange,
  onSubmit,
  onUpload,
  onRunOCR,
  features = {},
  onFeatureChange,
  disabled = false
}) => {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const dropZoneRef = useRef(null)

  const handleFileSelect = useCallback((selectedFiles) => {
    Array.from(selectedFiles).forEach(file => {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const fileData = {
        id: fileId,
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'pending',
        documentId: null
      }

      setFiles(prev => [...prev, fileData])

      // Simulate upload
      handleUpload(fileData)
    })
  }, [])

  const handleUpload = async (fileData) => {
    setUploadProgress(prev => ({ ...prev, [fileData.id]: 0 }))

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 50))
      setUploadProgress(prev => ({ ...prev, [fileData.id]: i }))
    }

    // Mock upload response
    const mockResponse = {
      document_id: `doc-${Date.now()}`,
      filepath: `/uploads/${fileData.name}`
    }

    setFiles(prev => prev.map(f =>
      f.id === fileData.id
        ? { ...f, status: 'uploaded', documentId: mockResponse.document_id }
        : f
    ))

    // Call onUpload callback
    onUpload?.(fileData.file, mockResponse)

    // Auto-run OCR if enabled
    if (features.ocr && mockResponse.document_id) {
      setTimeout(() => handleRunOCR(mockResponse.document_id, fileData.id), 500)
    }
  }

  const handleRunOCR = async (documentId, fileId) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, status: 'processing' } : f
    ))

    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

    // Simulate OCR progress
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setUploadProgress(prev => ({ ...prev, [fileId]: i }))
    }

    // Mock OCR result
    const mockOCRResult = {
      text: 'Sample extracted text from document...',
      fields: ['Field 1: Value 1', 'Field 2: Value 2'],
      confidence: 0.95
    }

    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, status: 'completed', ocrResult: mockOCRResult }
        : f
    ))

    onRunOCR?.(documentId)
  }

  const handleRemoveFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileId]
      return newProgress
    })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles)
    }
  }

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return FileText
    if (type?.includes('image')) return Image
    return File
  }

  const getFileTypeBadge = (type) => {
    if (type?.includes('pdf')) return 'PDF'
    if (type?.includes('image')) {
      if (type?.includes('png')) return 'PNG'
      if (type?.includes('jpg') || type?.includes('jpeg')) return 'JPG'
      return 'IMG'
    }
    return 'FILE'
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!value.trim() && files.length === 0) return
    if (disabled) return

    onSubmit?.(value, files)
    setFiles([])
    setUploadProgress({})
    inputRef.current?.focus()
  }

  const needsFileHint = (features.ocr || features.bank) && files.length === 0

  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative ${isDragging ? 'bg-cyan-50/50 dark:bg-cyan-900/10' : ''}`}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-cyan-500/10 dark:bg-cyan-400/10 border-2 border-dashed border-cyan-500 dark:border-cyan-400 rounded-2xl z-10 flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="w-12 h-12 text-cyan-500 dark:text-cyan-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
              Drop files here to upload
            </p>
          </div>
        </div>
      )}

      {/* File chips */}
      {files.length > 0 && (
        <div className="px-4 pt-4 pb-2 flex flex-wrap gap-2">
          {files.map((fileData) => {
            const FileIcon = getFileIcon(fileData.type)
            const progress = uploadProgress[fileData.id] || 0
            const isProcessing = fileData.status === 'processing'
            const isCompleted = fileData.status === 'completed'
            const needsOCR = features.ocr && fileData.status === 'uploaded' && !fileData.ocrResult

            return (
              <div
                key={fileData.id}
                className="group relative flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <FileIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px]">
                      {fileData.name}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {getFileTypeBadge(fileData.type)}
                    </span>
                  </div>
                  
                  {/* Progress indicator */}
                  {(isProcessing || progress > 0) && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {isProcessing && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          Running OCR... {progress}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* OCR Result Preview */}
                  {isCompleted && fileData.ocrResult && (
                    <div className="mt-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                      {fileData.ocrResult.fields?.slice(0, 2).join(' • ')}
                    </div>
                  )}

                  {/* Run OCR button */}
                  {needsOCR && (
                    <button
                      onClick={() => handleRunOCR(fileData.documentId, fileData.id)}
                      className="mt-1.5 text-[10px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
                    >
                      Run OCR
                    </button>
                  )}
                </div>

                {isCompleted && (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}

                <button
                  onClick={() => handleRemoveFile(fileData.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  aria-label={`Remove ${fileData.name}`}
                >
                  <X className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Features dropdown for mobile (outside input) */}
      <div className="px-4 pb-2 sm:hidden">
        <FeaturesDropdown
          features={features}
          onFeatureChange={onFeatureChange}
          placement="bottom-right"
        />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 px-4 pb-4">
          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex-shrink-0 p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Upload file"
            title="Upload file (PDF, PNG, JPG)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* File input (hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => {
              if (e.target.files.length > 0) {
                handleFileSelect(e.target.files)
                e.target.value = '' // Reset input
              }
            }}
            className="hidden"
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder={needsFileHint ? "Upload a file to use OCR / Bank statement parsing..." : "Type your message..."}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 pr-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              style={{
                minHeight: '48px',
                maxHeight: '120px'
              }}
            />

            {/* Features dropdown (inside input, right side) */}
            <div className="absolute right-2 bottom-2 hidden sm:block">
              <FeaturesDropdown
                features={features}
                onFeatureChange={onFeatureChange}
                placement="top-right"
              />
            </div>
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={(!value.trim() && files.length === 0) || disabled}
            className="flex-shrink-0 p-2.5 bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700 text-white rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Hint for file upload */}
        {needsFileHint && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              💡 Upload a file to use {features.ocr && 'OCR'} {features.ocr && features.bank && 'or'} {features.bank && 'Bank statement parsing'}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}

export default ChatInput

