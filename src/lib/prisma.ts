import { PrismaClient } from '@prisma/client';

// Global variable to store the Prisma client instance
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Create Prisma client with connection pooling configuration
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

// In development, store the client on the global object to prevent
// creating multiple instances during hot reloads
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown handler
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

// Connection pool configuration and health check
export async function connectToDatabase() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}

// Database health check function
export async function checkDatabaseHealth() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}

// Transaction helper for complex operations
export async function withTransaction<T>(
    callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
    return await prisma.$transaction(callback);
}

export default prisma;