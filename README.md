<<<<<<< HEAD
# Unified Inbox

A comprehensive multi-channel customer communication platform built with Next.js 14+, TypeScript, and Postgres.

## Features

- **Multi-Channel Support**: SMS, WhatsApp, Email, and Social Media
- **Real-Time Collaboration**: Team presence, @mentions, collaborative editing
- **Contact Management**: Unified profiles with interaction history
- **Message Scheduling**: Automated follow-ups and templates
- **Analytics Dashboard**: Performance metrics and reporting
- **Secure Integrations**: Twilio, Resend, social media APIs

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Better Auth
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Real-time**: WebSocket (Socket.io)
- **Integrations**: Twilio, Resend, Twitter API v2, Facebook Graph API

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd unified-inbox
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual values
   ```

4. Start the database services:
   ```bash
   docker-compose up -d postgres redis
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Services

The project includes Docker configurations for:

- **PostgreSQL**: Main database (port 5432)
- **Redis**: Caching and real-time features (port 6379)
- **Redis Commander**: Redis management UI (port 8081)

Start all services:
```bash
docker-compose up -d
```

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
├── lib/                 # Utility functions and configurations
├── types/               # TypeScript type definitions
└── styles/              # Global styles
```

## Environment Variables

See `.env.example` for all required and optional environment variables.

### Required Variables

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret

### Integration Variables

- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- Email: `RESEND_API_KEY`
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
=======
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
>>>>>>> origin/main
