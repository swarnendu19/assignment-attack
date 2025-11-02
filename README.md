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