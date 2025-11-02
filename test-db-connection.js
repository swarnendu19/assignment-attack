const { PrismaClient } = require('@prisma/client');

async function testConnection() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unified_inbox'
            }
        }
    });

    try {
        console.log('🔍 Testing database connection...');

        // Test basic connection
        await prisma.$connect();
        console.log('✅ Database connection successful');

        // Test query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database query successful:', result);

        // Test user count
        const userCount = await prisma.user.count();
        console.log('✅ User count:', userCount);

        // Test contact count
        const contactCount = await prisma.contact.count();
        console.log('✅ Contact count:', contactCount);

        // Test message count
        const messageCount = await prisma.message.count();
        console.log('✅ Message count:', messageCount);

        // Test integration count
        const integrationCount = await prisma.integration.count();
        console.log('✅ Integration count:', integrationCount);

        console.log('🎉 All database tests passed!');

    } catch (error) {
        console.error('❌ Database test failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();