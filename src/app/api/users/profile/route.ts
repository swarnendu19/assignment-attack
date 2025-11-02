import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/services/userService'
import { verifyToken } from '@/lib/middleware'
import { UserRole } from '@prisma/client'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
})

export async function GET(request: NextRequest) {
  try {
    const tokenData = await verifyToken(request)
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await userService.getUserById(tokenData.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tokenData = await verifyToken(request)
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateData = updateProfileSchema.parse(body)

    const updatedUser = await userService.updateUser(tokenData.userId, updateData)
    const authUser = await userService.getUserById(updatedUser.id)

    return NextResponse.json({
      success: true,
      user: authUser,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}