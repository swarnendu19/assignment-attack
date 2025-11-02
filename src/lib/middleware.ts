import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { userService } from '@/services/userService'

export interface TokenData {
  userId: string
  email: string
  role: UserRole
  teamId: string
}

/**
 * Verify JWT token from request headers
 */
export async function verifyToken(request: NextRequest): Promise<TokenData | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as TokenData
    
    // Verify user still exists and is active
    const user = await userService.getUserById(decoded.userId)
    if (!user || !user.isActive) {
      return null
    }

    return decoded
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request: NextRequest): Promise<TokenData> {
  const tokenData = await verifyToken(request)
  if (!tokenData) {
    throw new Error('Authentication required')
  }
  return tokenData
}

/**
 * Middleware to require specific role
 */
export async function requireRole(request: NextRequest, requiredRole: UserRole): Promise<TokenData> {
  const tokenData = await requireAuth(request)
  
  // Admin can access everything
  if (tokenData.role === UserRole.ADMIN) {
    return tokenData
  }

  // Check if user has required role or higher
  const roleHierarchy = {
    [UserRole.VIEWER]: 0,
    [UserRole.EDITOR]: 1,
    [UserRole.ADMIN]: 2,
  }

  if (roleHierarchy[tokenData.role] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions')
  }

  return tokenData
}

/**
 * Middleware to require permission for resource and action
 */
export async function requirePermission(
  request: NextRequest, 
  resource: string, 
  action: string
): Promise<TokenData> {
  const tokenData = await requireAuth(request)
  
  if (!userService.hasPermission(tokenData.role, resource, action)) {
    throw new Error(`Insufficient permissions: ${action} on ${resource}`)
  }

  return tokenData
}

/**
 * Middleware to ensure user belongs to the same team
 */
export async function requireSameTeam(request: NextRequest, targetTeamId: string): Promise<TokenData> {
  const tokenData = await requireAuth(request)
  
  if (tokenData.role !== UserRole.ADMIN && tokenData.teamId !== targetTeamId) {
    throw new Error('Access denied: different team')
  }

  return tokenData
}

/**
 * Extract team ID from request (query param or body)
 */
export function getTeamIdFromRequest(request: NextRequest, body?: any): string | null {
  // Try to get from query params first
  const url = new URL(request.url)
  const teamIdFromQuery = url.searchParams.get('teamId')
  
  if (teamIdFromQuery) {
    return teamIdFromQuery
  }

  // Try to get from request body
  if (body && body.teamId) {
    return body.teamId
  }

  return null
}