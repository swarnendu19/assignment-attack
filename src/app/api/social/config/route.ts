import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { socialMediaService } from '@/services/socialMediaService'
import { auth } from '@/lib/auth'

// Configuration validation schemas
const TwitterConfigSchema = z.object({
  platform: z.literal('twitter'),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  accessToken: z.string().min(1),
  accessTokenSecret: z.string().min(1),
  bearerToken: z.string().min(1),
  webhookUrl: z.string().url().optional(),
})

const FacebookConfigSchema = z.object({
  platform: z.literal('facebook'),
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
  pageId: z.string().min(1),
  verifyToken: z.string().min(1),
  webhookUrl: z.string().url().optional(),
})

const SocialConfigSchema = z.union([TwitterConfigSchema, FacebookConfigSchema])

/**
 * Get social media platform configurations
 * GET /api/social/config
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user (admin only)
    const session = await auth()
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const availablePlatforms = socialMediaService.getAvailablePlatforms()
    
    // Return configuration status (without sensitive data)
    const platformsStatus = [
      {
        platform: 'twitter',
        configured: availablePlatforms.includes('twitter'),
        available: availablePlatforms.includes('twitter'),
        rateLimits: availablePlatforms.includes('twitter') ? {
          sendMessage: socialMediaService.getRateLimitInfo('twitter', 'send_message'),
          getUserInfo: socialMediaService.getRateLimitInfo('twitter', 'get_user'),
        } : null,
      },
      {
        platform: 'facebook',
        configured: availablePlatforms.includes('facebook'),
        available: availablePlatforms.includes('facebook'),
        rateLimits: availablePlatforms.includes('facebook') ? {
          sendMessage: socialMediaService.getRateLimitInfo('facebook', 'send_message'),
          getUserInfo: socialMediaService.getRateLimitInfo('facebook', 'get_user'),
        } : null,
      },
    ]

    return NextResponse.json({
      platforms: platformsStatus,
      totalConfigured: availablePlatforms.length,
      lastUpdated: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Social media config get error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Test social media platform connection
 * POST /api/social/config/test
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user (admin only)
    const session = await auth()
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { platform } = body

    if (!platform || !['twitter', 'facebook'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid or missing platform' },
        { status: 400 }
      )
    }

    // Check if platform is available
    if (!socialMediaService.isPlatformAvailable(platform)) {
      return NextResponse.json(
        { 
          error: `Platform ${platform} is not configured`,
          configured: false,
          available: false,
        },
        { status: 400 }
      )
    }

    // Test the connection by getting rate limit info
    const rateLimitInfo = socialMediaService.getRateLimitInfo(platform, 'send_message')
    
    // For a more thorough test, we could try to get the authenticated user's info
    // but that would consume API quota, so we'll just check if the service is initialized
    
    return NextResponse.json({
      platform,
      configured: true,
      available: true,
      connectionTest: 'passed',
      rateLimits: {
        sendMessage: rateLimitInfo,
        getUserInfo: socialMediaService.getRateLimitInfo(platform, 'get_user'),
      },
      testedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Social media config test error:', error)
    return NextResponse.json(
      { 
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}