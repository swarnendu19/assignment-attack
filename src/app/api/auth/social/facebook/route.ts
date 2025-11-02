import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { auth } from '@/lib/auth'

/**
 * Handle Facebook OAuth flow
 * GET /api/auth/social/facebook
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user (admin only for social media setup)
    const session = await auth()
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'authorize' or 'callback'

    if (action === 'authorize') {
      // Step 1: Generate Facebook OAuth URL
      const appId = process.env.FACEBOOK_APP_ID!
      const redirectUri = `${request.nextUrl.origin}/api/auth/social/facebook?action=callback`
      
      const scopes = [
        'pages_messaging',
        'pages_read_engagement',
        'pages_manage_metadata',
        'pages_read_user_content',
        'pages_show_list'
      ].join(',')

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `response_type=code&` +
        `state=${crypto.randomUUID()}`

      return NextResponse.json({
        authUrl,
        state: 'generated', // In production, store this securely
      })
    } else if (action === 'callback') {
      // Step 2: Handle callback and exchange code for access token
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        return NextResponse.json(
          { error: `Facebook OAuth error: ${error}` },
          { status: 400 }
        )
      }

      if (!code) {
        return NextResponse.json(
          { error: 'Missing authorization code' },
          { status: 400 }
        )
      }

      const appId = process.env.FACEBOOK_APP_ID!
      const appSecret = process.env.FACEBOOK_APP_SECRET!
      const redirectUri = `${request.nextUrl.origin}/api/auth/social/facebook?action=callback`

      try {
        // Exchange code for access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
          params: {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          },
        })

        const { access_token: userAccessToken } = tokenResponse.data

        // Get user information
        const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
          params: {
            access_token: userAccessToken,
            fields: 'id,name,email,picture',
          },
        })

        const user = userResponse.data

        // Get user's pages (for Messenger integration)
        const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
          params: {
            access_token: userAccessToken,
            fields: 'id,name,access_token,category,tasks',
          },
        })

        const pages = pagesResponse.data.data || []

        // Filter pages that have messaging permissions
        const messagingPages = pages.filter((page: any) => 
          page.tasks && page.tasks.includes('MESSAGING')
        )

        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            profileImage: user.picture?.data?.url,
          },
          tokens: {
            userAccessToken,
          },
          pages: messagingPages.map((page: any) => ({
            id: page.id,
            name: page.name,
            accessToken: page.access_token,
            category: page.category,
          })),
          message: 'Facebook OAuth completed successfully',
        })
      } catch (error: any) {
        console.error('Facebook OAuth callback error:', error.response?.data || error.message)
        return NextResponse.json(
          { 
            error: 'Failed to complete Facebook OAuth',
            details: error.response?.data?.error?.message || error.message
          },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action parameter' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Facebook OAuth error:', error)
    return NextResponse.json(
      { 
        error: 'OAuth process failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get Facebook page information
 * POST /api/auth/social/facebook
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
    const { pageId, pageAccessToken } = body

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: 'Page ID and access token are required' },
        { status: 400 }
      )
    }

    try {
      // Get page information
      const pageResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
        params: {
          access_token: pageAccessToken,
          fields: 'id,name,category,about,picture,fan_count,website',
        },
      })

      const page = pageResponse.data

      // Test webhook subscription
      const subscriptionResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`, {
        params: {
          access_token: pageAccessToken,
        },
      })

      const subscriptions = subscriptionResponse.data.data || []

      return NextResponse.json({
        page: {
          id: page.id,
          name: page.name,
          category: page.category,
          about: page.about,
          picture: page.picture?.data?.url,
          fanCount: page.fan_count,
          website: page.website,
        },
        webhookSubscribed: subscriptions.length > 0,
        subscriptions,
      })
    } catch (error: any) {
      console.error('Facebook page info error:', error.response?.data || error.message)
      return NextResponse.json(
        { 
          error: 'Failed to get page information',
          details: error.response?.data?.error?.message || error.message
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Facebook page info error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

/**
 * Revoke Facebook OAuth tokens
 * DELETE /api/auth/social/facebook
 */
export async function DELETE(request: NextRequest) {
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
    const { accessToken } = body

    if (accessToken) {
      try {
        // Revoke the access token
        await axios.delete(`https://graph.facebook.com/v18.0/me/permissions`, {
          params: {
            access_token: accessToken,
          },
        })
      } catch (error) {
        console.error('Facebook token revocation error:', error)
        // Continue even if revocation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Facebook OAuth tokens revoked',
    })
  } catch (error) {
    console.error('Facebook OAuth revocation error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke OAuth tokens' },
      { status: 500 }
    )
  }
}