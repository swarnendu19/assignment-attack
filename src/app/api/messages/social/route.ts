import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { socialMediaService } from '@/services/socialMediaService'
import { auth } from '@/lib/auth'

// Request validation schema
const SendSocialMessageSchema = z.object({
  platform: z.enum(['twitter', 'facebook']),
  recipientId: z.string().min(1, 'Recipient ID is required'),
  text: z.string().min(1, 'Message text is required').max(2000, 'Message too long'),
  mediaUrls: z.array(z.string().url()).optional(),
  contactId: z.string().optional(),
})

/**
 * Send message via social media platforms
 * POST /api/messages/social
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = SendSocialMessageSchema.parse(body)

    const { platform, recipientId, text, mediaUrls, contactId } = validatedData

    // Check if platform is available
    if (!socialMediaService.isPlatformAvailable(platform)) {
      return NextResponse.json(
        { 
          error: `Platform ${platform} is not configured or available`,
          availablePlatforms: socialMediaService.getAvailablePlatforms()
        },
        { status: 400 }
      )
    }

    // Check rate limits
    const rateLimitInfo = socialMediaService.getRateLimitInfo(platform, 'send_message')
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

    // Send the message
    const result = await socialMediaService.sendMessage(
      platform,
      recipientId,
      text,
      mediaUrls
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Failed to send message',
          platform,
          details: result.error
        },
        { status: 400 }
      )
    }

    // Log the successful send
    console.log(`Message sent via ${platform}:`, {
      messageId: result.messageId,
      recipientId,
      userId: session.user.id,
      contactId,
    })

    // Return success response
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      platform,
      sentAt: new Date().toISOString(),
      rateLimitInfo: {
        remaining: socialMediaService.getRateLimitInfo(platform, 'send_message').remaining,
        resetTime: socialMediaService.getRateLimitInfo(platform, 'send_message').resetTime,
      },
    })

  } catch (error) {
    console.error('Social media send error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get available social media platforms and their status
 * GET /api/messages/social
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const availablePlatforms = socialMediaService.getAvailablePlatforms()
    
    // Get rate limit info for each platform
    const platformsInfo = availablePlatforms.map(platform => {
      const sendRateLimit = socialMediaService.getRateLimitInfo(platform, 'send_message')
      const userRateLimit = socialMediaService.getRateLimitInfo(platform, 'get_user')
      
      return {
        platform,
        available: true,
        rateLimits: {
          sendMessage: {
            remaining: sendRateLimit.remaining,
            resetTime: sendRateLimit.resetTime?.toISOString(),
          },
          getUserInfo: {
            remaining: userRateLimit.remaining,
            resetTime: userRateLimit.resetTime?.toISOString(),
          },
        },
      }
    })

    return NextResponse.json({
      platforms: platformsInfo,
      totalAvailable: availablePlatforms.length,
    })

  } catch (error) {
    console.error('Social media platforms info error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get platforms info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}