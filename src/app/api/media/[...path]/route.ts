import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { MediaStorageService } from '@/lib/utils/media-storage';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Reconstruct the file path
        const filePath = params.path.join('/');
        const decodedPath = decodeURIComponent(filePath);

        // Initialize media storage service
        const mediaStorage = new MediaStorageService();
        const baseDir = process.env.MEDIA_STORAGE_DIR || './uploads';
        const fullPath = path.join(baseDir, decodedPath);

        // Security check: ensure the path is within the uploads directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedBaseDir = path.resolve(baseDir);

        if (!resolvedPath.startsWith(resolvedBaseDir)) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Read the file
        const fileBuffer = await fs.readFile(fullPath);
        const stats = await fs.stat(fullPath);

        // Determine MIME type from file extension
        const mimeType = getMimeTypeFromExtension(path.extname(fullPath));

        // Set appropriate headers
        const headers = new Headers();
        headers.set('Content-Type', mimeType);
        headers.set('Content-Length', stats.size.toString());
        headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        headers.set('Last-Modified', stats.mtime.toUTCString());

        // Check if client has cached version
        const ifModifiedSince = request.headers.get('if-modified-since');
        if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
            return new NextResponse(null, { status: 304, headers });
        }

        return new NextResponse(fileBuffer, { headers });

    } catch (error) {
        console.error('Error serving media file:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.3gp': 'video/3gpp',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.aac': 'audio/aac',
        '.amr': 'audio/amr',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.csv': 'text/csv'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}