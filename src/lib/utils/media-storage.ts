import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MediaAttachment, MediaType } from '../types/message';

export interface MediaStorageConfig {
    baseDir: string;
    maxFileSize: number; // in bytes
    allowedMimeTypes: string[];
    generateThumbnails: boolean;
}

export interface StoredMedia {
    id: string;
    originalUrl: string;
    localPath: string;
    thumbnailPath?: string;
    filename: string;
    size: number;
    mimeType: string;
    type: MediaType;
    storedAt: Date;
}

export class MediaStorageService {
    private config: MediaStorageConfig;

    constructor(config?: Partial<MediaStorageConfig>) {
        this.config = {
            baseDir: process.env.MEDIA_STORAGE_DIR || './uploads',
            maxFileSize: 10 * 1024 * 1024, // 10MB default
            allowedMimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'video/mp4',
                'video/3gpp',
                'audio/mpeg',
                'audio/ogg',
                'audio/wav',
                'audio/aac',
                'audio/amr',
                'application/pdf',
                'text/plain',
                'text/csv'
            ],
            generateThumbnails: true,
            ...config
        };

        // Ensure base directory exists
        this.ensureDirectoryExists(this.config.baseDir);
    }

    /**
     * Download and store media from a URL
     */
    async storeMediaFromUrl(
        url: string,
        originalFilename?: string,
        metadata?: Record<string, any>
    ): Promise<StoredMedia> {
        try {
            // Download the file
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to download media: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const contentLength = parseInt(response.headers.get('content-length') || '0');

            // Validate file size
            if (contentLength > this.config.maxFileSize) {
                throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
            }

            // Validate MIME type
            if (!this.config.allowedMimeTypes.includes(contentType)) {
                throw new Error(`File type ${contentType} is not allowed`);
            }

            // Generate unique filename
            const fileId = this.generateFileId();
            const extension = this.getExtensionFromMimeType(contentType);
            const filename = originalFilename || `${fileId}${extension}`;
            const sanitizedFilename = this.sanitizeFilename(filename);

            // Create directory structure
            const dateDir = this.getDateDirectory();
            const fullDir = path.join(this.config.baseDir, dateDir);
            await this.ensureDirectoryExists(fullDir);

            // Save file
            const localPath = path.join(fullDir, `${fileId}_${sanitizedFilename}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(localPath, buffer);

            // Get actual file size
            const stats = await fs.stat(localPath);
            const actualSize = stats.size;

            // Generate thumbnail if needed
            let thumbnailPath: string | undefined;
            if (this.config.generateThumbnails && this.isImageType(contentType)) {
                thumbnailPath = await this.generateThumbnail(localPath, contentType);
            }

            const storedMedia: StoredMedia = {
                id: fileId,
                originalUrl: url,
                localPath,
                thumbnailPath,
                filename: sanitizedFilename,
                size: actualSize,
                mimeType: contentType,
                type: this.getMediaTypeFromMimeType(contentType),
                storedAt: new Date()
            };

            return storedMedia;

        } catch (error) {
            throw new Error(`Failed to store media: ${error}`);
        }
    }

    /**
     * Store media from buffer
     */
    async storeMediaFromBuffer(
        buffer: Buffer,
        mimeType: string,
        filename?: string,
        metadata?: Record<string, any>
    ): Promise<StoredMedia> {
        try {
            // Validate file size
            if (buffer.length > this.config.maxFileSize) {
                throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
            }

            // Validate MIME type
            if (!this.config.allowedMimeTypes.includes(mimeType)) {
                throw new Error(`File type ${mimeType} is not allowed`);
            }

            // Generate unique filename
            const fileId = this.generateFileId();
            const extension = this.getExtensionFromMimeType(mimeType);
            const sanitizedFilename = filename ? this.sanitizeFilename(filename) : `${fileId}${extension}`;

            // Create directory structure
            const dateDir = this.getDateDirectory();
            const fullDir = path.join(this.config.baseDir, dateDir);
            await this.ensureDirectoryExists(fullDir);

            // Save file
            const localPath = path.join(fullDir, `${fileId}_${sanitizedFilename}`);
            await fs.writeFile(localPath, buffer);

            // Generate thumbnail if needed
            let thumbnailPath: string | undefined;
            if (this.config.generateThumbnails && this.isImageType(mimeType)) {
                thumbnailPath = await this.generateThumbnail(localPath, mimeType);
            }

            const storedMedia: StoredMedia = {
                id: fileId,
                originalUrl: '',
                localPath,
                thumbnailPath,
                filename: sanitizedFilename,
                size: buffer.length,
                mimeType,
                type: this.getMediaTypeFromMimeType(mimeType),
                storedAt: new Date()
            };

            return storedMedia;

        } catch (error) {
            throw new Error(`Failed to store media from buffer: ${error}`);
        }
    }

    /**
     * Get media file as buffer
     */
    async getMediaBuffer(localPath: string): Promise<Buffer> {
        try {
            return await fs.readFile(localPath);
        } catch (error) {
            throw new Error(`Failed to read media file: ${error}`);
        }
    }

    /**
     * Delete stored media
     */
    async deleteMedia(localPath: string, thumbnailPath?: string): Promise<void> {
        try {
            // Delete main file
            await fs.unlink(localPath);

            // Delete thumbnail if exists
            if (thumbnailPath) {
                try {
                    await fs.unlink(thumbnailPath);
                } catch (error) {
                    // Ignore thumbnail deletion errors
                    console.warn('Failed to delete thumbnail:', error);
                }
            }
        } catch (error) {
            throw new Error(`Failed to delete media: ${error}`);
        }
    }

    /**
     * Get public URL for media (if serving through web server)
     */
    getPublicUrl(localPath: string): string {
        const relativePath = path.relative(this.config.baseDir, localPath);
        return `/api/media/${encodeURIComponent(relativePath)}`;
    }

    /**
     * Convert MediaAttachment to StoredMedia by downloading
     */
    async processMediaAttachment(attachment: MediaAttachment): Promise<StoredMedia> {
        return this.storeMediaFromUrl(
            attachment.url,
            attachment.filename,
            { originalId: attachment.id }
        );
    }

    // Private helper methods
    private generateFileId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    private sanitizeFilename(filename: string): string {
        // Remove or replace unsafe characters
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 100); // Limit length
    }

    private getDateDirectory(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return path.join(year.toString(), month, day);
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    private getExtensionFromMimeType(mimeType: string): string {
        const extensions: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/3gpp': '.3gp',
            'audio/mpeg': '.mp3',
            'audio/ogg': '.ogg',
            'audio/wav': '.wav',
            'audio/aac': '.aac',
            'audio/amr': '.amr',
            'application/pdf': '.pdf',
            'text/plain': '.txt',
            'text/csv': '.csv'
        };

        return extensions[mimeType] || '.bin';
    }

    private getMediaTypeFromMimeType(mimeType: string): MediaType {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'document';
    }

    private isImageType(mimeType: string): boolean {
        return mimeType.startsWith('image/');
    }

    private async generateThumbnail(localPath: string, mimeType: string): Promise<string | undefined> {
        // This is a placeholder for thumbnail generation
        // In a real implementation, you would use a library like Sharp or similar
        // For now, we'll just return undefined

        try {
            // TODO: Implement actual thumbnail generation
            // const sharp = require('sharp');
            // const thumbnailPath = localPath.replace(/(\.[^.]+)$/, '_thumb$1');
            // await sharp(localPath)
            //     .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            //     .jpeg({ quality: 80 })
            //     .toFile(thumbnailPath);
            // return thumbnailPath;

            return undefined;
        } catch (error) {
            console.warn('Failed to generate thumbnail:', error);
            return undefined;
        }
    }

    /**
     * Clean up old media files
     */
    async cleanupOldFiles(olderThanDays: number = 30): Promise<number> {
        let deletedCount = 0;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        try {
            const cleanupDir = async (dirPath: string): Promise<void> => {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);

                    if (entry.isDirectory()) {
                        await cleanupDir(fullPath);
                    } else {
                        const stats = await fs.stat(fullPath);
                        if (stats.mtime < cutoffDate) {
                            await fs.unlink(fullPath);
                            deletedCount++;
                        }
                    }
                }
            };

            await cleanupDir(this.config.baseDir);
            return deletedCount;

        } catch (error) {
            console.error('Error during cleanup:', error);
            return deletedCount;
        }
    }
}