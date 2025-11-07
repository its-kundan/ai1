import { useState } from 'react'
import { Upload, File, X, CheckCircle } from 'lucide-react'
import { uploadDocument, processOCR } from '../utils/api'

const FileUpload = () => {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

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
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    handleFiles(selectedFiles)
  }

  const handleFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      return validTypes.includes(file.type)
    })

    if (validFiles.length !== newFiles.length) {
      alert('Some files were skipped. Only PDF, JPG, and PNG files are supported.')
    }

    setFiles(prev => [...prev, ...validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      status: 'pending'
    }))])
  }

  const handleRemove = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploadStatus('uploading')
    
    try {
      // Upload all files
      const uploadPromises = files.map(async (fileData) => {
        const response = await uploadDocument(fileData.file, 'general')
        return { ...fileData, documentId: response.document_id, status: 'uploaded' }
      })

      const uploadedFiles = await Promise.all(uploadPromises)
      setFiles(uploadedFiles)
      
      // Process OCR for all uploaded files
      setUploadStatus('processing')
      const ocrPromises = uploadedFiles.map(async (fileData) => {
        if (fileData.documentId) {
          try {
            const ocrResponse = await processOCR(fileData.documentId, true)
            return { ...fileData, status: 'complete', ocrResult: ocrResponse }
          } catch (error) {
            console.error(`OCR failed for ${fileData.file.name}:`, error)
            return { ...fileData, status: 'error', error: error.message }
          }
        }
        return fileData
      })

      const processedFiles = await Promise.all(ocrPromises)
      setFiles(processedFiles)
      
      setUploadStatus('complete')
      
      setTimeout(() => {
        setUploadStatus(null)
        setFiles([])
      }, 2000)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadStatus('error')
      alert(`Upload failed: ${error.message}`)
      setTimeout(() => {
        setUploadStatus(null)
      }, 3000)
    }
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Upload Documents</h2>
        <p className="text-gray-600">Upload PDF or image files for OCR processing</p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <Upload className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drag and drop files here
          </p>
          <p className="text-sm text-gray-500 mb-4">or</p>
          <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
            Browse Files
          </label>
          <p className="text-xs text-gray-500 mt-4">
            Supported formats: PDF, JPG, PNG
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-800 mb-3">Selected Files ({files.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map(({ id, file, status }) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    {status === 'complete' && (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(id)}
                    className="ml-2 p-1 hover:bg-red-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleUpload}
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploadStatus === 'uploading' && 'Uploading...'}
              {uploadStatus === 'processing' && 'Processing...'}
              {uploadStatus === 'complete' && 'Complete!'}
              {!uploadStatus && 'Upload & Process'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload

