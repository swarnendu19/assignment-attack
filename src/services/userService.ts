import { PrismaClient, User, Team, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { 
  CreateUserInput, 
  UpdateUserInput, 
  TeamInput, 
  AuthUser,
  Permission,
  ROLE_PERMISSIONS 
} from '@/types/auth'

const prisma = new PrismaClient()

export class UserService {
  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const hashedPassword = input.password 
      ? await bcrypt.hash(input.password, 12)
      : null

    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashedPassword,
        role: input.role || UserRole.EDITOR,
        teamId: input.teamId,
        avatar: input.avatar,
      },
    })
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        team: true,
      },
    })

    if (!user) return null

    return this.mapToAuthUser(user)
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        team: true,
      },
    })
  }

  /**
   * Update user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: input,
    })
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    })
  }

  /**
   * Get all users in a team
   */
  async getUsersByTeam(teamId: string): Promise<AuthUser[]> {
    const users = await prisma.user.findMany({
      where: { teamId },
      include: {
        team: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return users.map(user => this.mapToAuthUser(user))
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        lastActiveAt: new Date(),
      },
    })
  }

  /**
   * Verify user password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false
    return await bcrypt.compare(password, user.password)
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    })
  }

  /**
   * Create a new team
   */
  async createTeam(input: TeamInput): Promise<Team> {
    return await prisma.team.create({
      data: {
        name: input.name,
        settings: input.settings as any,
      },
    })
  }

  /**
   * Get team by ID
   */
  async getTeamById(id: string): Promise<Team | null> {
    return await prisma.team.findUnique({
      where: { id },
      include: {
        users: true,
      },
    })
  }

  /**
   * Update team
   */
  async updateTeam(id: string, input: Partial<TeamInput>): Promise<Team> {
    return await prisma.team.update({
      where: { id },
      data: {
        ...input,
        settings: input.settings as any,
      },
    })
  }

  /**
   * Check if user has permission for a resource and action
   */
  hasPermission(userRole: UserRole, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole]
    
    // Admin has all permissions
    if (userRole === UserRole.ADMIN) {
      return true
    }

    // Check specific permissions
    return permissions.some(permission => 
      (permission.resource === resource || permission.resource === '*') &&
      permission.action === action
    )
  }

  /**
   * Validate user permissions for a resource
   */
  validatePermission(userRole: UserRole, resource: string, action: string): void {
    if (!this.hasPermission(userRole, resource, action)) {
      throw new Error(`Insufficient permissions: ${action} on ${resource}`)
    }
  }

  /**
   * Get user permissions
   */
  getUserPermissions(userRole: UserRole): Permission[] {
    return ROLE_PERMISSIONS[userRole]
  }

  /**
   * Map database user to AuthUser
   */
  private mapToAuthUser(user: User & { team?: Team }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
      avatar: user.avatar,
      isActive: user.isActive,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
    }
  }
}

export const userService = new UserService()