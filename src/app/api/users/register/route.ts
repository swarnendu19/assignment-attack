import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/services/userService'
import { UserRole } from '@prisma/client'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  teamName: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, teamName } = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create team if teamName is provided, otherwise create a default team
    const team = await userService.createTeam({
      name: teamName || `${name}'s Team`,
    })

    // Create user
    const user = await userService.createUser({
      email,
      password,
      name,
      teamId: team.id,
      role: UserRole.ADMIN, // First user in team becomes admin
    })

    // Return user without password
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      team,
    })
  } catch (error) {
    console.error('Registration error:', error)
    
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