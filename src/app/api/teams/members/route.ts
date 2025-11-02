import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/services/userService'
import { requireRole, requireAuth } from '@/lib/middleware'
import { UserRole } from '@prisma/client'

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.EDITOR),
})

const updateMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const tokenData = await requireAuth(request)
    
    const members = await userService.getUsersByTeam(tokenData.teamId)
    
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Get team members error:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const tokenData = await requireRole(request, UserRole.ADMIN)
    
    const body = await request.json()
    const { email, name, role } = inviteUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create user without password (they'll need to set it up)
    const user = await userService.createUser({
      email,
      name,
      role,
      teamId: tokenData.teamId,
    })

    // Return user without password
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('Invite user error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tokenData = await requireRole(request, UserRole.ADMIN)
    
    const body = await request.json()
    const { userId, role, isActive } = updateMemberSchema.parse(body)

    // Ensure the user being updated is in the same team
    const targetUser = await userService.getUserById(userId)
    if (!targetUser || targetUser.teamId !== tokenData.teamId) {
      return NextResponse.json(
        { error: 'User not found or not in your team' },
        { status: 404 }
      )
    }

    // Update user
    const updatedUser = await userService.updateUser(userId, {
      role,
      isActive,
    })

    const authUser = await userService.getUserById(updatedUser.id)
    
    return NextResponse.json({
      success: true,
      user: authUser,
    })
  } catch (error) {
    console.error('Update member error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}