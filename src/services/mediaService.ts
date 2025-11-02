import { ChannelType } from '@prisma/client'

export interface MediaOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface OptimizedMedia {
  file: File
  thumbnail?: File
  originalSize: number
  optimizedSize: number
  compressionRatio: number
}

export class MediaService {
  /**
   * Optimize media file based on channel requirements
   */
  async optimizeMedia(
    file: File, 
    channel: ChannelType,
    options?: MediaOptimizationOptions
  ): Promise<OptimizedMedia> {
    const channelOptions = this.getChannelOptimizationOptions(channel)
    const finalOptions = { ...channelOptions, ...options }

    if (file.type.startsWith('image/')) {
      return this.optimizeImage(file, finalOptions)
    } else if (file.type.startsWith('video/')) {
      return this.optimizeVideo(file, finalOptions)
    } else {
      // For documents, just return as-is
      return {
        file,
        originalSize: file.size,
        optimizedSize: file.size,
        compressionRatio: 1,
      }
    }
  }

  /**
   * Generate thumbnail for media file
   */
  async generateThumbnail(file: File, size: number = 150): Promise<File | null> {
    if (file.type.startsWith('image/')) {
      return this.generateImageThumbnail(file, size)
    } else if (file.type.startsWith('video/')) {
      return this.generateVideoThumbnail(file, size)
    }
    return null
  }

  /**
   * Get channel-specific optimization options
   */
  private getChannelOptimizationOptions(channel: ChannelType): MediaOptimizationOptions {
    switch (channel) {
      case ChannelType.SMS:
        return {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 0.8,
          format: 'jpeg',
        }
      case ChannelType.WHATSAPP:
        return {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.85,
          format: 'jpeg',
        }
      case ChannelType.EMAIL:
        return {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.9,
          format: 'jpeg',
        }
      default:
        return {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 0.8,
          format: 'jpeg',
        }
    }
  }

  /**
   * Optimize image file
   */
  private async optimizeImage(
    file: File, 
    options: MediaOptimizationOptions
  ): Promise<OptimizedMedia> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        try {
          // Calculate new dimensions
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth || 1024,
            options.maxHeight || 1024
          )

          canvas.width = width
          canvas.height = height

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to optimize image'))
                return
              }

              const optimizedFile = new File([blob], file.name, {
                type: `image/${options.format || 'jpeg'}`,
                lastModified: Date.now(),
              })

              // Generate thumbnail
              this.generateImageThumbnail(optimizedFile, 150).then(thumbnail => {
                resolve({
                  file: optimizedFile,
                  thumbnail: thumbnail || undefined,
                  originalSize: file.size,
                  optimizedSize: optimizedFile.size,
                  compressionRatio: file.size / optimizedFile.size,
                })
              })
            },
            `image/${options.format || 'jpeg'}`,
            options.quality || 0.8
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Optimize video file (placeholder - would need more complex implementation)
   */
  private async optimizeVideo(
    file: File, 
    options: MediaOptimizationOptions
  ): Promise<OptimizedMedia> {
    // For now, just return the original file
    // In a real implementation, you would use FFmpeg.js or similar
    const thumbnail = await this.generateVideoThumbnail(file, 150)
    
    return {
      file,
      thumbnail: thumbnail || undefined,
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 1,
    }
  }

  /**
   * Generate image thumbnail
   */
  private async generateImageThumbnail(file: File, size: number): Promise<File | null> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        const { width, height } = this.calculateDimensions(
          img.width,
          img.height,
          size,
          size
        )

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null)
              return
            }

            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            resolve(thumbnailFile)
          },
          'image/jpeg',
          0.7
        )
      }

      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Generate video thumbnail
   */
  private async generateVideoThumbnail(file: File, size: number): Promise<File | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2) // Seek to middle or 1 second
      }

      video.onseeked = () => {
        const { width, height } = this.calculateDimensions(
          video.videoWidth,
          video.videoHeight,
          size,
          size
        )

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(video, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null)
              return
            }

            const thumbnailFile = new File([blob], `thumb_${file.name}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            resolve(thumbnailFile)
          },
          'image/jpeg',
          0.7
        )
      }

      video.onerror = () => resolve(null)
      video.src = URL.createObjectURL(file)
      video.load()
    })
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight }

    if (width > maxWidth) {
      height = (height * maxWidth) / width
      width = maxWidth
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height
      height = maxHeight
    }

    return { width: Math.round(width), height: Math.round(height) }
  }

  /**
   * Validate file for channel
   */
  validateFileForChannel(file: File, channel: ChannelType): { valid: boolean; error?: string } {
    const maxSizes = {
      [ChannelType.SMS]: 5 * 1024 * 1024, // 5MB
      [ChannelType.WHATSAPP]: 16 * 1024 * 1024, // 16MB
      [ChannelType.EMAIL]: 25 * 1024 * 1024, // 25MB
      [ChannelType.TWITTER]: 5 * 1024 * 1024, // 5MB
      [ChannelType.FACEBOOK]: 8 * 1024 * 1024, // 8MB
    }

    const allowedTypes = {
      [ChannelType.SMS]: ['image/', 'video/'],
      [ChannelType.WHATSAPP]: ['image/', 'video/', 'audio/', 'application/pdf'],
      [ChannelType.EMAIL]: ['image/', 'video/', 'audio/', 'application/', 'text/'],
      [ChannelType.TWITTER]: ['image/', 'video/'],
      [ChannelType.FACEBOOK]: ['image/', 'video/'],
    }

    const maxSize = maxSizes[channel]
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit for ${channel}`,
      }
    }

    const allowed = allowedTypes[channel]
    const isAllowed = allowed.some(type => file.type.startsWith(type))
    if (!isAllowed) {
      return {
        valid: false,
        error: `File type not supported for ${channel}`,
      }
    }

    return { valid: true }
  }
}

export const mediaService = new MediaService()