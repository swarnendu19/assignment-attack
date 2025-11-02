import { PrismaClient, UserRole, MessageChannel, IntegrationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create admin user
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@unifiedinbox.com' },
        update: {},
        create: {
            email: 'admin@unifiedinbox.com',
            name: 'Admin User',
            role: UserRole.ADMIN,
        },
    });

    // Create editor user
    const editorUser = await prisma.user.upsert({
        where: { email: 'editor@unifiedinbox.com' },
        update: {},
        create: {
            email: 'editor@unifiedinbox.com',
            name: 'Editor User',
            role: UserRole.EDITOR,
        },
    });

    // Create viewer user
    const viewerUser = await prisma.user.upsert({
        where: { email: 'viewer@unifiedinbox.com' },
        update: {},
        create: {
            email: 'viewer@unifiedinbox.com',
            name: 'Viewer User',
            role: UserRole.VIEWER,
        },
    });

    console.log('✅ Created users:', { adminUser: adminUser.id, editorUser: editorUser.id, viewerUser: viewerUser.id });

    // Create sample contacts
    const contact1 = await prisma.contact.create({
        data: {
            name: 'John Doe',
            phone: '+1234567890',
            email: 'john.doe@example.com',
            socialHandles: {
                twitter: '@johndoe',
                linkedin: 'john-doe-123'
            },
            metadata: {
                source: 'website',
                tags: ['customer', 'vip']
            }
        },
    });

    const contact2 = await prisma.contact.create({
        data: {
            name: 'Jane Smith',
            phone: '+1987654321',
            email: 'jane.smith@example.com',
            socialHandles: {
                twitter: '@janesmith',
                facebook: 'jane.smith.profile'
            },
            metadata: {
                source: 'referral',
                tags: ['prospect']
            }
        },
    });

    console.log('✅ Created contacts:', { contact1: contact1.id, contact2: contact2.id });

    // Create integration configurations
    const smsIntegration = await prisma.integration.upsert({
        where: { channel: MessageChannel.SMS },
        update: {},
        create: {
            channel: MessageChannel.SMS,
            status: IntegrationStatus.ACTIVE,
            config: {
                provider: 'twilio',
                webhookUrl: '/api/webhooks/twilio',
                capabilities: ['send', 'receive', 'mms']
            },
            credentials: {
                // These would be encrypted in production
                accountSid: 'TWILIO_ACCOUNT_SID_PLACEHOLDER',
                authToken: 'TWILIO_AUTH_TOKEN_PLACEHOLDER',
                phoneNumber: 'TWILIO_PHONE_NUMBER_PLACEHOLDER'
            }
        },
    });

    const whatsappIntegration = await prisma.integration.upsert({
        where: { channel: MessageChannel.WHATSAPP },
        update: {},
        create: {
            channel: MessageChannel.WHATSAPP,
            status: IntegrationStatus.ACTIVE,
            config: {
                provider: 'twilio',
                webhookUrl: '/api/webhooks/twilio',
                capabilities: ['send', 'receive', 'media'],
                sandbox: true
            },
            credentials: {
                accountSid: 'TWILIO_ACCOUNT_SID_PLACEHOLDER',
                authToken: 'TWILIO_AUTH_TOKEN_PLACEHOLDER',
                whatsappNumber: 'whatsapp:+14155238886'
            }
        },
    });

    const emailIntegration = await prisma.integration.upsert({
        where: { channel: MessageChannel.EMAIL },
        update: {},
        create: {
            channel: MessageChannel.EMAIL,
            status: IntegrationStatus.ACTIVE,
            config: {
                provider: 'resend',
                webhookUrl: '/api/webhooks/email',
                capabilities: ['send', 'receive', 'attachments']
            },
            credentials: {
                apiKey: 'RESEND_API_KEY_PLACEHOLDER',
                fromEmail: 'noreply@unifiedinbox.com'
            }
        },
    });

    console.log('✅ Created integrations:', {
        sms: smsIntegration.id,
        whatsapp: whatsappIntegration.id,
        email: emailIntegration.id
    });

    // Create sample message templates
    const welcomeTemplate = await prisma.template.create({
        data: {
            name: 'Welcome Message',
            content: 'Hi {{name}}, welcome to our service! We\'re excited to have you on board.',
            variables: {
                name: { type: 'string', required: true, description: 'Customer name' }
            },
            category: 'onboarding',
            isActive: true,
            createdBy: adminUser.id
        },
    });

    const followUpTemplate = await prisma.template.create({
        data: {
            name: 'Follow Up',
            content: 'Hi {{name}}, just following up on our conversation. Let me know if you have any questions!',
            variables: {
                name: { type: 'string', required: true, description: 'Customer name' }
            },
            category: 'follow-up',
            isActive: true,
            createdBy: editorUser.id
        },
    });

    console.log('✅ Created templates:', {
        welcome: welcomeTemplate.id,
        followUp: followUpTemplate.id
    });

    // Create sample notes
    const note1 = await prisma.note.create({
        data: {
            contactId: contact1.id,
            userId: editorUser.id,
            content: 'Customer is interested in our premium plan. Follow up next week.',
            type: 'PUBLIC'
        },
    });

    const note2 = await prisma.note.create({
        data: {
            contactId: contact2.id,
            userId: adminUser.id,
            content: 'VIP customer - handle with priority.',
            type: 'PRIVATE'
        },
    });

    console.log('✅ Created notes:', { note1: note1.id, note2: note2.id });

    // Create sample assignments
    const assignment1 = await prisma.assignment.create({
        data: {
            contactId: contact1.id,
            userId: editorUser.id,
            assignedBy: adminUser.id
        },
    });

    console.log('✅ Created assignments:', { assignment1: assignment1.id });

    console.log('🎉 Database seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });