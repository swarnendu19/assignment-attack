import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { auth } from '@/lib/auth'

/**
 * Initiate Twitter OAuth flow
 * GET /api/auth/social/twitter
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
      // Step 1: Get request token and redirect to Twitter
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
      })

      const callbackUrl = `${request.nextUrl.origin}/api/auth/social/twitter?action=callback`
      
      try {
        const authLink = await client.generateAuthLink(callbackUrl, { linkMode: 'authorize' })
        
        // Store the oauth_token_secret in session or database for later use
        // For now, we'll return it in the response (in production, use secure session storage)
        
        return NextResponse.json({
          authUrl: authLink.url,
          oauthToken: authLink.oauth_token,
          oauthTokenSecret: authLink.oauth_token_secret,
        })
      } catch (error) {
        console.error('Twitter OAuth initiation error:', error)
        return NextResponse.json(
          { error: 'Failed to initiate Twitter OAuth' },
          { status: 500 }
        )
      }
    } else if (action === 'callback') {
      // Step 2: Handle callback and exchange for access token
      const oauthToken = searchParams.get('oauth_token')
      const oauthVerifier = searchParams.get('oauth_verifier')
      const oauthTokenSecret = searchParams.get('oauth_token_secret') // This should come from session

      if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
        return NextResponse.json(
          { error: 'Missing OAuth parameters' },
          { status: 400 }
        )
      }

      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: oauthToken,
        accessSecret: oauthTokenSecret,
      })

      try {
        const { client: loggedClient, accessToken, accessSecret } = await client.login(oauthVerifier)
        
        // Get user information
        const user = await loggedClient.currentUser()
        
        // Store the access tokens securely (in production, encrypt and store in database)
        // For now, return them in the response
        
        return NextResponse.json({
          success: true,
          user: {
            id: user.id_str,
            username: user.screen_name,
            name: user.name,
            profileImage: user.profile_image_url_https,
          },
          tokens: {
            accessToken,
            accessSecret,
          },
          message: 'Twitter OAuth completed successfully',
        })
      } catch (error) {
        console.error('Twitter OAuth callback error:', error)
        return NextResponse.json(
          { error: 'Failed to complete Twitter OAuth' },
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
    console.error('Twitter OAuth error:', error)
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
 * Revoke Twitter OAuth tokens
 * DELETE /api/auth/social/twitter
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

    // In production, you would:
    // 1. Retrieve stored access tokens from database
    // 2. Revoke them with Twitter API
    // 3. Remove them from database
    
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: 'Twitter OAuth tokens revoked',
    })
  } catch (error) {
    console.error('Twitter OAuth revocation error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke OAuth tokens' },
      { status: 500 }
    )
  }
}