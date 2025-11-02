'use client'

import { useState, useRef } from 'react'
import { ChannelType } from '@prisma/client'

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video' | 'document'
}

interface MediaUploaderProps {
  channel: ChannelType
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  maxFileSize?: number // in MB
}

export function MediaUploader({ 
  channel, 
  onFilesChange, 
  maxFiles = 10, 
  maxFileSize = 25 
}: MediaUploaderProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAcceptedTypes = () => {
    switch (channel) {
      case ChannelType.SMS:
      case ChannelType.WHATSAPP:
        return 'image/*,video/*,.pdf'
      case ChannelType.EMAIL:
        return 'image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx'
      default:
        return 'image/*'
    }
  }

  const getMaxFileSize = () => {
    switch (channel) {
      case ChannelType.SMS:
        return 5 // 5MB for MMS
      case ChannelType.WHATSAPP:
        return 16 // 16MB for WhatsApp
      case ChannelType.EMAIL:
        return 25 // 25MB for email
      default:
        return 5
    }
  }

  const validateFile = (file: File): string | null => {
    const maxSize = getMaxFileSize() * 1024 * 1024 // Convert to bytes
    
    if (file.size > maxSize) {
      return `File size must be less than ${getMaxFileSize()}MB`
    }

    const allowedTypes = getAcceptedTypes().split(',').map(type => type.trim())
    const isValidType = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'))
      }
      return file.name.toLowerCase().endsWith(type.replace('.', ''))
    })

    if (!isValidType) {
      return 'File type not supported for this channel'
    }

    return null
  }

  const getFileType = (file: File): 'image' | 'video' | 'document' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    return 'document'
  }

  const processFiles = (files: FileList) => {
    setError(null)
    const newFiles: MediaFile[] = []
    const fileArray = Array.from(files)

    if (mediaFiles.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    for (const file of fileArray) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      const mediaFile: MediaFile = {
        file,
        preview: URL.createObjectURL(file),
        type: getFileType(file),
      }
      newFiles.push(mediaFile)
    }

    const updatedFiles = [...mediaFiles, ...newFiles]
    setMediaFiles(updatedFiles)
    onFilesChange(updatedFiles.map(mf => mf.file))
  }

  const removeFile = (index: number) => {
    const updatedFiles = mediaFiles.filter((_, i) => i !== index)
    // Revoke object URL to free memory
    URL.revokeObjectURL(mediaFiles[index].preview)
    setMediaFiles(updatedFiles)
    onFilesChange(updatedFiles.map(mf => mf.file))
    setError(null)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type: 'image' | 'video' | 'document') => {
    switch (type) {
      case 'image':
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'video':
        return (
          <svg className="h-8 w-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )
      case 'document':
        return (
          <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Drop files here or click to upload
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {getAcceptedTypes()} up to {getMaxFileSize()}MB each
              </span>
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              multiple
              accept={getAcceptedTypes()}
              onChange={handleFileInput}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* File Preview */}
      {mediaFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Attached Files ({mediaFiles.length}/{maxFiles})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mediaFiles.map((mediaFile, index) => (
              <div
                key={index}
                className="relative bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="flex items-center space-x-3">
                  {mediaFile.type === 'image' ? (
                    <img
                      src={mediaFile.preview}
                      alt={mediaFile.file.name}
                      className="w-12 h-12 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center">
                      {getFileIcon(mediaFile.type)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {mediaFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(mediaFile.file.size)}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => removeFile(index)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}