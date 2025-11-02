# Database Setup and Schema Documentation

This document describes the database schema, setup process, and maintenance procedures for the Unified Inbox application.

## Overview

The application uses PostgreSQL as the primary database with Prisma as the ORM. The schema is designed to support:

- Multi-channel message management (SMS, WhatsApp, Email, Social Media)
- Contact management with auto-merging capabilities
- Real-time collaboration features
- Message scheduling and automation
- Comprehensive audit logging
- Role-based access control

## Database Schema

### Core Models

#### Users (`users`)
- **Purpose**: Authentication and role management
- **Key Fields**: `id`, `email`, `name`, `role`
- **Roles**: `VIEWER`, `EDITOR`, `ADMIN`
- **Indexes**: `email` (unique)

#### Contacts (`contacts`)
- **Purpose**: Customer contact information
- **Key Fields**: `id`, `name`, `phone`, `email`, `socialHandles`, `metadata`
- **Features**: Supports fuzzy matching for duplicate detection
- **Indexes**: `phone`, `email`, `createdAt`

#### Messages (`messages`)
- **Purpose**: Unified message storage across all channels
- **Key Fields**: `id`, `contactId`, `channel`, `direction`, `content`, `status`, `threadId`
- **Channels**: `SMS`, `WHATSAPP`, `EMAIL`, `TWITTER`, `FACEBOOK`, `INSTAGRAM`, `LINKEDIN`
- **Indexes**: `contactId + createdAt`, `threadId`, `channel`, `status`, `scheduledAt`

#### Notes (`notes`)
- **Purpose**: Contact notes and collaboration
- **Key Fields**: `id`, `contactId`, `userId`, `content`, `type`
- **Types**: `PUBLIC`, `PRIVATE`
- **Indexes**: `contactId + createdAt`, `userId`

#### Integrations (`integrations`)
- **Purpose**: Channel configuration and credentials
- **Key Fields**: `id`, `channel`, `config`, `status`, `credentials`
- **Security**: Credentials are stored encrypted
- **Indexes**: `channel` (unique)

### Supporting Models

#### Assignments (`assignments`)
- **Purpose**: Conversation assignment to team members
- **Constraint**: One assignment per contact
- **Indexes**: `userId`, `contactId` (unique)

#### Presence (`presence`)
- **Purpose**: Real-time collaboration status
- **Key Fields**: `userId`, `contactId`, `status`, `lastSeen`
- **Indexes**: `contactId`, `userId` (unique)

#### Audit Logs (`audit_logs`)
- **Purpose**: Security and compliance logging
- **Key Fields**: `userId`, `action`, `resource`, `resourceId`
- **Indexes**: `userId + createdAt`, `action`, `resource + resourceId`, `createdAt`

#### Scheduled Jobs (`scheduled_jobs`)
- **Purpose**: Message scheduling and automation
- **Key Fields**: `type`, `payload`, `scheduledAt`, `status`
- **Indexes**: `status + scheduledAt`, `type`

#### Templates (`templates`)
- **Purpose**: Message templates with variables
- **Key Fields**: `name`, `content`, `variables`, `channel`, `category`
- **Indexes**: `category`, `channel`, `isActive`

## Setup Instructions

### 1. Prerequisites

```bash
# Install dependencies
npm install prisma @prisma/client dotenv ts-node

# Ensure PostgreSQL is running
docker-compose up -d postgres
```

### 2. Environment Configuration

Create `.env.local` with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unified_inbox"
```

### 3. Database Initialization

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 4. Verification

```bash
# Test database connection
node test-db-connection.js

# Open Prisma Studio (optional)
npm run db:studio
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Populate with initial data |
| `npm run db:reset` | Reset database (destructive) |
| `npm run db:studio` | Open Prisma Studio |

## Performance Optimizations

### Indexes

The schema includes optimized indexes for:

- **Contact Search**: `phone`, `email`, `createdAt`
- **Message Queries**: `contactId + createdAt`, `threadId`, `channel`
- **Real-time Features**: `status + scheduledAt`, `userId + createdAt`
- **Analytics**: `action`, `resource + resourceId`, `createdAt`

### Connection Pooling

Prisma client is configured with:
- Connection pooling enabled
- Graceful shutdown handling
- Development logging
- Health check utilities

### Query Optimization

Utility classes provide optimized queries:
- `ContactQueries`: Search, duplicate detection
- `MessageQueries`: Thread retrieval, unread counts
- `AnalyticsQueries`: Performance metrics
- `AuditLogger`: Compliance logging

## Data Management

### Backup Strategy

```bash
# Create backup
pg_dump -h localhost -U postgres unified_inbox > backup.sql

# Restore backup
psql -h localhost -U postgres unified_inbox < backup.sql
```

### Maintenance Tasks

```typescript
// Cleanup old audit logs (90 days)
await DatabaseMaintenance.cleanupOldAuditLogs(90);

// Cleanup failed jobs (7 days)
await DatabaseMaintenance.cleanupFailedJobs(7);

// Check table sizes
const sizes = await DatabaseMaintenance.getTableSizes();
```

### Data Migration

When adding new fields or models:

1. Update `schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Update seed script if needed
4. Test migration on staging environment

## Security Considerations

### Data Protection

- **Encryption**: Sensitive credentials encrypted at rest
- **Access Control**: Role-based permissions
- **Audit Trail**: Comprehensive logging
- **Data Retention**: Configurable cleanup policies

### Best Practices

- Use environment variables for all secrets
- Validate webhook signatures
- Implement rate limiting
- Regular security audits
- Backup encryption

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   docker ps
   docker-compose up -d postgres
   ```

2. **Migration Conflicts**
   ```bash
   # Reset and re-migrate (development only)
   npm run db:reset
   ```

3. **Schema Drift**
   ```bash
   # Generate new migration
   npx prisma migrate dev
   ```

### Monitoring

- Monitor connection pool usage
- Track query performance
- Set up alerts for failed migrations
- Regular backup verification

## Development Workflow

1. **Schema Changes**: Update `schema.prisma`
2. **Migration**: Run `npm run db:migrate`
3. **Testing**: Verify with `node test-db-connection.js`
4. **Seeding**: Update seed script if needed
5. **Documentation**: Update this README

## Production Deployment

### Environment Setup

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
PRISMA_GENERATE_DATAPROXY=true
```

### Migration Strategy

1. Backup production database
2. Test migrations on staging
3. Run migrations during maintenance window
4. Verify data integrity
5. Monitor application health

### Monitoring

- Set up database monitoring
- Configure alerting for errors
- Track performance metrics
- Regular backup verification