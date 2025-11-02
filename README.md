# Unified Multi-Channel Inbox

A comprehensive communication system that aggregates messages from multiple channels into a single, unified interface.

## Features

- **Multi-Channel Support**: Email, Slack, Discord, WhatsApp, Telegram, Teams, Twitter, Facebook, LinkedIn, and SMS
- **Real-time Updates**: Live message synchronization across all channels
- **Unified Interface**: Single dashboard to manage all communications
- **Smart Filtering**: Advanced filtering and search capabilities
- **Priority Management**: Automatic and manual message prioritization
- **Team Collaboration**: Multi-user support with role-based access

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS 4.0 with modern CSS features
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for real-time features
- **Authentication**: NextAuth.js
- **File Storage**: AWS S3 compatible storage

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd unified-multi-channel-inbox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration values.

4. **Start the database**
   ```bash
   docker-compose up -d
   ```

5. **Set up the database**
   ```bash
   npm run db:push
   npm run db:generate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Database Management

- **Generate Prisma client**: `npm run db:generate`
- **Push schema changes**: `npm run db:push`
- **Run migrations**: `npm run db:migrate`
- **Open Prisma Studio**: `npm run db:studio`

### Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
├── lib/                # Utility libraries and configurations
├── types/              # TypeScript type definitions
├── services/           # External service integrations
├── hooks/              # Custom React hooks
└── utils/              # Helper functions

prisma/
├── schema.prisma       # Database schema
└── migrations/         # Database migrations
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.