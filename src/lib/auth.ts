import { betterAuth } from "better-auth"
import { PrismaClient } from "@prisma/client"
import { userService } from "@/services/userService"

const prisma = new PrismaClient()

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  callbacks: {
    async signUp({ user, account }: { user: any; account: any }) {
      // Create a default team for new users if they don't have one
      let teamId = user.teamId
      
      if (!teamId) {
        const team = await userService.createTeam({
          name: `${user.name || user.email}'s Team`,
        })
        teamId = team.id
      }

      // Update user with team information
      await userService.updateUser(user.id, {
        // Set default role as EDITOR for new signups
      })

      return { user: { ...user, teamId } }
    },
    async signIn({ user }: { user: any }) {
      // Update last active timestamp
      await userService.updateLastActive(user.id)
      return { user }
    },
  },
})

export type Session = typeof auth.$Infer.Session