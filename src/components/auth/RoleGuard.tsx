'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@prisma/client'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { user } = useAuth()

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface PermissionGuardProps {
  children: React.ReactNode
  resource: string
  action: string
  fallback?: React.ReactNode
}

export function PermissionGuard({ 
  children, 
  resource, 
  action, 
  fallback = null 
}: PermissionGuardProps) {
  const { user } = useAuth()

  if (!user || !hasPermission(user.role, resource, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

function hasPermission(userRole: UserRole, resource: string, action: string): boolean {
  // Admin has all permissions
  if (userRole === UserRole.ADMIN) {
    return true
  }

  // Define permissions based on role
  const permissions = {
    [UserRole.VIEWER]: [
      { resource: 'conversations', action: 'read' },
      { resource: 'messages', action: 'read' },
      { resource: 'contacts', action: 'read' },
      { resource: 'notes', action: 'read' },
    ],
    [UserRole.EDITOR]: [
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
    [UserRole.ADMIN]: [], // Admin handled above
  }

  const userPermissions = permissions[userRole] || []
  return userPermissions.some(permission => 
    permission.resource === resource && permission.action === action
  )
}