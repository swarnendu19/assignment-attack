'use client';

import { useState } from 'react';
import { MediaAttachment as MediaAttachmentType } from '@/lib/types/message';

interface MediaAttachmentProps {
    media: MediaAttachmentType;
    isOutbound?: boolean;
}

export function MediaAttachment({ media, isOutbound = false }: MediaAttachmentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('word')) return '📝';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
        return '📎';
    };

    const handleImageLoad = () => {
        setIsLoading(false);
    };

    const handleImageError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    const handleDownload = () => {
        if (media.url) {
            const link = document.createElement('a');
            link.href = media.url;
            link.download = media.filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Render based on media type
    switch (media.type) {
        case 'image':
            return (
                <div className="relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                        </div>
                    )}

                    {hasError ? (
                        <div className={`p-3 rounded-lg border-2 border-dashed ${isOutbound ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50'
                            }`}>
                            <div className="flex items-center space-x-2 text-sm">
                                <span>🖼️</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{media.filename || 'Image'}</p>
                                    <p className="text-xs opacity-75">Failed to load</p>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className={`p-1 rounded hover:bg-opacity-20 hover:bg-black transition-colors`}
                                    title="Download"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <img
                                src={media.url}
                                alt={media.filename || 'Image'}
                                className={`max-w-full h-auto rounded-lg cursor-pointer transition-transform ${isExpanded ? 'transform scale-110' : 'hover:scale-105'
                                    }`}
                                style={{ maxHeight: isExpanded ? 'none' : '200px' }}
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                                onClick={() => setIsExpanded(!isExpanded)}
                            />

                            {/* Image overlay with filename and size */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 rounded-b-lg opacity-0 hover:opacity-100 transition-opacity">
                                <div className="flex justify-between items-center">
                                    <span className="truncate">{media.filename || 'Image'}</span>
                                    {media.size && <span>{formatFileSize(media.size)}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );

        case 'video':
            return (
                <div className="relative">
                    <video
                        src={media.url}
                        controls
                        className="max-w-full h-auto rounded-lg"
                        style={{ maxHeight: '200px' }}
                        preload="metadata"
                    >
                        Your browser does not support the video tag.
                    </video>

                    <div className="mt-1 text-xs opacity-75">
                        <div className="flex justify-between items-center">
                            <span className="truncate">{media.filename || 'Video'}</span>
                            {media.size && <span>{formatFileSize(media.size)}</span>}
                        </div>
                    </div>
                </div>
            );

        case 'audio':
            return (
                <div className={`p-3 rounded-lg ${isOutbound ? 'bg-blue-500 bg-opacity-20' : 'bg-gray-100'
                    }`}>
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎵</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{media.filename || 'Audio'}</p>
                            {media.size && (
                                <p className="text-xs opacity-75">{formatFileSize(media.size)}</p>
                            )}
                            <audio
                                src={media.url}
                                controls
                                className="w-full mt-2"
                                style={{ height: '32px' }}
                            >
                                Your browser does not support the audio tag.
                            </audio>
                        </div>
                    </div>
                </div>
            );

        case 'document':
        default:
            return (
                <div className={`p-3 rounded-lg border ${isOutbound
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}>
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getFileIcon(media.mimeType || '')}</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{media.filename || 'Document'}</p>
                            <div className="flex items-center space-x-2 text-xs opacity-75">
                                {media.size && <span>{formatFileSize(media.size)}</span>}
                                {media.mimeType && (
                                    <>
                                        <span>•</span>
                                        <span className="uppercase">{media.mimeType.split('/')[1]}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleDownload}
                            className={`p-2 rounded-lg transition-colors ${isOutbound
                                    ? 'hover:bg-blue-200 text-blue-700'
                                    : 'hover:bg-gray-200 text-gray-700'
                                }`}
                            title="Download"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            );
    }
}