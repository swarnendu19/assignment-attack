unified-inbox/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── inbox/
│   │   ├── contacts/
│   │   ├── analytics/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── messages/
│   │   ├── contacts/
│   │   ├── webhooks/
│   │   │   ├── twilio/
│   │   │   ├── facebook/
│   │   │   └── twitter/
│   │   └── integrations/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── inbox/
│   ├── contacts/
│   ├── composer/
│   ├── analytics/
│   └── ui/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── integrations/
│   │   ├── factory.ts
│   │   ├── twilio.ts
│   │   ├── email.ts
│   │   └── social.ts
│   ├── utils.ts
│   └── validation.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Twilio Setup Steps

### 1. Create Free Account
1. Visit https://www.twilio.com/try-twilio
2. Sign up with email
3. Verify phone number

### 2. Get Phone Number
1. Navigate to Phone Numbers → Manage → Buy a number
2. Select SMS and MMS capabilities
3. Note your number (e.g., +1234567890)

### 3. Setup WhatsApp Sandbox
1. Go to Messaging → Try it out → Send a WhatsApp message
2. Follow instructions to connect WhatsApp
3. Use sandbox number: `whatsapp:+14155238886`

### 4. Configure Webhooks
Set webhook URLs in Twilio Console:
- **SMS Webhook**: `https://your-domain.com/api/webhooks/twilio/sms`
- **WhatsApp Webhook**: `https://your-domain.com/api/webhooks/twilio/whatsapp`
- Method: HTTP POST

### 5. Test with ngrok (Development)
```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3000

# Use ngrok URL for webhooks
# Example: https://abc123.ngrok.io/api/webhooks/twilio/sms
```

## Key Decisions & Architecture

### Channel Abstraction
- **Factory Pattern**: Unified interface for all channels
- **Message Normalization**: Single `Message` model with channel metadata
- **Extensibility**: Add new channels via config without core changes

### Real-time Collaboration
- **Optimistic Updates**: React Query mutations with rollback
- **WebSockets**: Pusher/Ably for presence and live updates
- **Conflict Resolution**: Last-write-wins with version tracking

### Security
- **Webhook Validation**: Twilio signature verification
- **OAuth Flows**: PKCE for social media integrations
- **Encryption**: Private notes encrypted at rest
- **Rate Limiting**: Per-user API quotas

### Scalability
- **Message Queue**: BullMQ for scheduled sends and automation
- **Caching**: Redis for contact lookups and analytics
- **Database Indexing**: Composite indexes on (contactId, createdAt)

## Integration Comparison

| Channel | Latency | Cost/Message | Reliability | Media Support |
|---------|---------|--------------|-------------|---------------|
| SMS | 1-3s | $0.0075 | 99.9% | MMS |
| WhatsApp | 1-2s | $0.005 | 99.5% | Images, Docs |
| Email | 5-30s | Free-$0.001 | 98% | Attachments |
| Twitter DM | 2-5s | Free | 95% | Images, GIFs |
| Facebook | 2-4s | Free | 96% | Rich media |

## Development Checklist

- [ ] Setup Next.js project with TypeScript
- [ ] Configure Postgres and Prisma
- [ ] Implement Better Auth with roles
- [ ] Create database schema and migrations
- [ ] Build unified inbox UI with filters
- [ ] Integrate Twilio SMS/WhatsApp
- [ ] Implement contact management
- [ ] Add message composer with scheduling
- [ ] Build analytics dashboard
- [ ] Add real-time collaboration features
- [ ] Implement webhook handlers
- [ ] Add optional integrations (email, social)
- [ ] Write comprehensive tests
- [ ] Create documentation and ERD
- [ ] Record demo video

## Testing Strategy

### Unit Tests
- Validation schemas (Zod)
- Utility functions
- Integration factories

### Integration Tests
- API routes
- Webhook handlers
- Database operations

### E2E Tests
- User authentication flow
- Send/receive messages
- Contact management
- Scheduling automation

## Deployment

### Recommended Stack
- **Hosting**: Vercel/Railway
- **Database**: Supabase/Neon
- **Queue**: Upstash Redis + QStash
- **Monitoring**: Sentry + LogRocket

### Pre-deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Webhook URLs updated
- [ ] SSL certificates valid
- [ ] Rate limiting enabled
- [ ] Error tracking setup

## Next Steps
1. Review Prisma schema design
2. Implement authentication layer
3. Build core inbox components
4. Integrate first channel (Twilio SMS)
5. Add real-time features
6. Expand to additional channels

## Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Twilio Docs](https://www.twilio.com/docs)
- [Better Auth](https://better-auth.com)
- [Tailwind CSS](https://tailwindcss.com)

---

**Estimated Development Time**: 12-18 hours
**Submission Deadline**: 4 days from receipt