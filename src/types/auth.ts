import { UserRole } from '@prisma/client'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name: string
  teamId?: string
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  teamId: string
  avatar: string | null
  isActive: boolean
  lastActiveAt: Date | null
  createdAt: Date
}

export interface CreateUserInput {
  email: string
  name?: string
  password?: string
  role?: UserRole
  teamId: string
  avatar?: string
}

export interface UpdateUserInput {
  name?: string
  avatar?: string
  role?: UserRole
  isActive?: boolean
}

export interface TeamInput {
  name: string
  settings?: Record<string, unknown>
}

export interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete'
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  VIEWER: [
    { resource: 'conversations', action: 'read' },
    { resource: 'messages', action: 'read' },
    { resource: 'contacts', action: 'read' },
    { resource: 'notes', action: 'read' },
  ],
  EDITOR: [
    { resource: 'conversations', action: 'read' },
    { resource: 'conversations', action: 'create' },
    { resource: 'conversations', action: 'update' },
    { resource: 'messages', action: 'read' },
    { resource: 'messages', action: 'create' },
    { resource: 'contacts', action: 'read' },
    { resource: 'contacts', action: 'create' },
    { resource: 'contacts', action: 'update' },
    { resource: 'notes', action: 'read' },
    { resource: 'notes', action: 'create' },
    { resource: 'notes', action: 'update' },
    { resource: 'scheduledMessages', action: 'read' },
    { resource: 'scheduledMessages', action: 'create' },
    { resource: 'scheduledMessages', action: 'update' },
    { resource: 'scheduledMessages', action: 'delete' },
  ],
  ADMIN: [
    { resource: '*', action: 'create' },
    { resource: '*', action: 'read' },
    { resource: '*', action: 'update' },
    { resource: '*', action: 'delete' },
  ],
}