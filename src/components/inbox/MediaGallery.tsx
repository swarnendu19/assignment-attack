'use client'

import { useState } from 'react'
import { Attachment } from '@/types/messages'
import { OptimizedImage, ImageGallery } from '@/components/ui/OptimizedImage'

interface MediaGalleryProps {
  attachments: Attachment[]
  className?: string
}

export function MediaGallery({ attachments, className = '' }: MediaGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const images = attachments.filter(att => att.contentType.startsWith('image/'))
  const videos = attachments.filter(att => att.contentType.startsWith('video/'))
  const documents = attachments.filter(att => !att.contentType.startsWith('image/') && !att.contentType.startsWith('video/'))

  const openImageModal = (url: string) => {
    setSelectedImage(url)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) {
      return (
        <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      )
    }
    if (contentType.includes('word') || contentType.includes('document')) {
      return (
        <svg className="h-8 w-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      )
    }
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
      return (
        <svg className="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
      )
    }
    return (
      <svg className="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  if (attachments.length === 0) return null

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Images */}
      {images.length > 0 && (
        <div>
          {images.length === 1 ? (
            <div className="relative">
              <OptimizedImage
                src={images[0].thumbnailUrl || images[0].url}
                alt={images[0].filename}
                width={300}
                height={300}
                className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: '300px' }}
                onClick={() => openImageModal(images[0].url)}
                placeholder="blur"
                lazy={true}
                fallbackSrc="/images/image-placeholder.png"
              />
            </div>
          ) : (
            <ImageGallery
              images={images.slice(0, 4).map(image => ({
                src: image.thumbnailUrl || image.url,
                alt: image.filename,
                width: 150,
                height: 150,
              }))}
              columns={2}
              gap={8}
              className="cursor-pointer"
              itemClassName="h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
              lazy={true}
            />
          )}
          {images.length > 4 && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              +{images.length - 4} more images
            </div>
          )}
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video) => (
            <div key={video.id} className="relative">
              <video
                controls
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '300px' }}
              >
                <source src={video.url} type={video.contentType} />
                Your browser does not support the video tag.
              </video>
              <div className="mt-1 text-xs text-gray-500">
                {video.filename} ({formatFileSize(video.size)})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {getFileIcon(doc.contentType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(doc.size)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <a
                  href={doc.url}
                  download={doc.filename}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={closeImageModal}>
          <div className="relative max-w-4xl max-h-full p-4">
            <OptimizedImage
              src={selectedImage}
              alt="Full size"
              fill={true}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
              priority={true}
              quality={90}
            />
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}