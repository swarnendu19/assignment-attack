# Authentication System Documentation

## Overview

The Unified Inbox authentication system is built using Better Auth, providing secure user authentication with role-based access control (RBAC). The system supports both email/password authentication and Google OAuth.

## Features

### ✅ Implemented Features

1. **Better Auth Integration**
   - Email/password authentication
   - Google OAuth support (configurable)
   - Secure session management
   - Database-backed user storage

2. **Role-Based Access Control (RBAC)**
   - Three role levels: VIEWER, EDITOR, ADMIN
   - Hierarchical permissions (ADMIN > EDITOR > VIEWER)
   - Role-based middleware for API routes
   - UI components that adapt based on user role

3. **Authentication Middleware**
   - Protect API routes with authentication
   - Role-based route protection
   - Helper functions for role checking

4. **User Interface**
   - Login page with email/password and Google OAuth
   - Registration page with validation
   - Protected dashboard layout
   - Admin panel for user management

## Architecture

### Database Schema

The authentication system uses the following database tables:

- `user` - User accounts with role information
- `session` - Active user sessions
- `account` - OAuth account linking
- `verification` - Email verification tokens

### Role Hierarchy

```
ADMIN (Level 2)
  ├── Can access all features
  ├── User management
  └── System administration

EDITOR (Level 1)
  ├── Can create and edit content
  ├── Manage contacts and messages
  └── Access analytics

VIEWER (Level 0)
  ├── Read-only access
  └── View messages and contacts
```

## API Routes

### Authentication Endpoints

- `POST /api/auth/sign-in/email` - Email/password login
- `POST /api/auth/sign-up/email` - User registration
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session
- `GET /api/auth/google` - Google OAuth login

### Protected API Routes

- `GET /api/user/profile` - Get user profile (requires authentication)
- `GET /api/admin/users` - List all users (requires ADMIN role)

## Usage Examples

### Protecting API Routes

```typescript
import { withAuth, withAdmin } from "@/lib/auth-middleware";

// Require authentication
export const GET = withAuth(async (req) => {
  const user = req.user;
  return NextResponse.json({ user });
});

// Require admin role
export const GET = withAdmin(async (req) => {
  // Only admins can access this
  return NextResponse.json({ adminData: "secret" });
});
```

### Client-Side Authentication

```typescript
import { useSession, signIn, signOut } from "@/lib/auth-client";

function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <LoginButton />;

  return <div>Welcome, {session.user.email}!</div>;
}
```

### Role-Based UI

```typescript
import { hasRole } from "@/lib/auth";

function AdminPanel({ user }) {
  if (!hasRole(user, "ADMIN")) {
    return <div>Access denied</div>;
  }

  return <div>Admin controls...</div>;
}
```

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unified_inbox"

# Authentication
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Better Auth Configuration

The auth configuration is in `src/lib/auth.ts`:

```typescript
export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "EDITOR",
      },
    },
  },
});
```

## Testing

### Running Tests

```bash
npm test -- --testPathPatterns=auth
```

### Test Coverage

- ✅ Role-based access control functions
- ✅ Authentication middleware
- ✅ Role hierarchy validation
- ✅ Error handling

## Security Features

1. **Secure Session Management**
   - HTTP-only cookies
   - CSRF protection
   - Session expiration

2. **Password Security**
   - Bcrypt hashing
   - Minimum password requirements

3. **Role-Based Security**
   - Server-side role validation
   - API route protection
   - UI access control

## Troubleshooting

### Common Issues

1. **Database Connection**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL environment variable

2. **Google OAuth**
   - Verify client ID and secret
   - Check redirect URLs in Google Console

3. **Session Issues**
   - Clear browser cookies
   - Check NEXTAUTH_SECRET configuration

### Debug Mode

Set `LOG_LEVEL=debug` in environment variables for detailed logging.

## Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Two-factor authentication
- [ ] Social login with additional providers
- [ ] Advanced audit logging
- [ ] Rate limiting for authentication endpoints

## Requirements Fulfilled

This implementation satisfies the following requirements from the specification:

- **1.1**: Authentication with Better Auth ✅
- **1.2**: Credentials and Google OAuth providers ✅
- **1.3**: Role-based access control (viewer/editor/admin) ✅
- **1.4**: Authentication middleware for API routes ✅
- **Login/Register pages**: With proper error handling ✅

The authentication system is now fully functional and ready for use in the Unified Inbox application.