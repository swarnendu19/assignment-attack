import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/services/socialMediaService'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: {
    platform: string
    userId: string
  }
}

/**
 * Get user information from social media platform
 * GET /api/social/users/[platform]/[userId]
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { platform, userId } = params

    // Validate platform
    if (!['twitter', 'facebook'].includes(platform)) {
      return NextResponse.json(
        { 
          error: 'Invalid platform',
          supportedPlatforms: ['twitter', 'facebook']
        },
        { status: 400 }
      )
    }

    // Check if platform is available
    if (!socialMediaService.isPlatformAvailable(platform as 'twitter' | 'facebook')) {
      return NextResponse.json(
        { 
          error: `Platform ${platform} is not configured or available`,
          availablePlatforms: socialMediaService.getAvailablePlatforms()
        },
        { status: 400 }
      )
    }

    // Check rate limits
    const rateLimitInfo = socialMediaService.getRateLimitInfo(platform as 'twitter' | 'facebook', 'get_user')
    if (rateLimitInfo.remaining === 0 && rateLimitInfo.resetTime && rateLimitInfo.resetTime > new Date()) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          platform,
          resetTime: rateLimitInfo.resetTime.toISOString()
        },
        { status: 429 }
      )
    }

    // Get user information
    const userInfo = await socialMediaService.getUserInfo(platform as 'twitter' | 'facebook', userId)

    if (!userInfo) {
      return NextResponse.json(
        { 
          error: 'User not found or inaccessible',
          platform,
          userId
        },
        { status: 404 }
      )
    }

    // Return user information
    return NextResponse.json({
      user: userInfo,
      platform,
      retrievedAt: new Date().toISOString(),
      rateLimitInfo: {
        remaining: socialMediaService.getRateLimitInfo(platform as 'twitter' | 'facebook', 'get_user').remaining,
        resetTime: socialMediaService.getRateLimitInfo(platform as 'twitter' | 'facebook', 'get_user').resetTime,
      },
    })

  } catch (error) {
    console.error('Social media user info error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get user information',
        platform: params.platform,
        userId: params.userId,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}