import { ChannelType, Direction } from '@prisma/client'
import { 
  SocialPlatform, 
  SocialMediaService, 
  SocialSendResult, 
  SocialUserInfo, 
  SocialMessageStatus,
  SocialMediaMessage,
  SocialRateLimiter,
  SocialRateLimit
} from '@/types/social'
import { UnifiedMessage, RawChannelMessage } from '@/types/messages'
import { twitterService, TwitterService } from './twitterService'
import { facebookService, FacebookService } from './facebookService'
import { messageService } from './messageService'

/**
 * Rate limiter for social media APIs
 */
export class SocialMediaRateLimiter implements SocialRateLimiter {
  private limits: Map<string, SocialRateLimit> = new Map()

  async checkLimit(platform: SocialPlatform, endpoint: string): Promise<boolean> {
    const key = `${platform}:${endpoint}`
    const limit = this.limits.get(key)
    
    if (!limit) {
      return true // No limit set, allow request
    }

    if (limit.remaining <= 0 && new Date() < limit.resetTime) {
      return false // Rate limit exceeded
    }

    if (new Date() >= limit.resetTime) {
      // Reset the limit
      this.limits.delete(key)
      return true
    }

    return limit.remaining > 0
  }

  updateLimit(platform: SocialPlatform, endpoint: string, headers: Record<string, string>): void {
    const key = `${platform}:${endpoint}`
    
    // Parse rate limit headers based on platform
    let limit: number = 0
    let remaining: number = 0
    let resetTime: Date = new Date()

    if (platform === 'twitter') {
      // Twitter rate limit headers
      limit = parseInt(headers['x-rate-limit-limit'] || '0')
      remaining = parseInt(headers['x-rate-limit-remaining'] || '0')
      const resetTimestamp = parseInt(headers['x-rate-limit-reset'] || '0')
      resetTime = new Date(resetTimestamp * 1000)
    } else if (platform === 'facebook') {
      // Facebook rate limit headers (less standardized)
      limit = parseInt(headers['x-app-usage'] || '100')
      remaining = Math.max(0, 100 - limit) // Facebook uses usage percentage
      resetTime = new Date(Date.now() + 60 * 60 * 1000) // Reset in 1 hour
    }

    if (limit > 0) {
      this.limits.set(key, {
        platform,
        endpoint,
        limit,
        remaining,
        resetTime,
      })
    }
  }

  getRemainingRequests(platform: SocialPlatform, endpoint: string): number {
    const key = `${platform}:${endpoint}`
    const limit = this.limits.get(key)
    return limit?.remaining || -1 // -1 means unknown
  }

  getResetTime(platform: SocialPlatform, endpoint: string): Date | null {
    const key = `${platform}:${endpoint}`
    const limit = this.limits.get(key)
    return limit?.resetTime || null
  }
}

/**
 * Unified social media service that manages multiple platforms
 */
export class UnifiedSocialMediaService {
  private services: Map<SocialPlatform, SocialMediaService> = new Map()
  private rateLimiter: SocialMediaRateLimiter

  constructor() {
    this.rateLimiter = new SocialMediaRateLimiter()
    this.initializeServices()
  }

  /**
   * Initialize available social media services
   */
  private initializeServices(): void {
    // Initialize Twitter service if available
    if (twitterService) {
      this.services.set('twitter', twitterService)
    }

    // Initialize Facebook service if available
    if (facebookService) {
      this.services.set('facebook', facebookService)
    }
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): SocialPlatform[] {
    return Array.from(this.services.keys())
  }

  /**
   * Check if a platform is available
   */
  isPlatformAvailable(platform: SocialPlatform): boolean {
    return this.services.has(platform)
  }

  /**
   * Send message to a specific platform
   */
  async sendMessage(
    platform: SocialPlatform,
    recipientId: string,
    text: string,
    mediaUrls?: string[]
  ): Promise<SocialSendResult> {
    const service = this.services.get(platform)
    if (!service) {
      return {
        success: false,
        error: `Platform ${platform} is not available`,
        platform,
      }
    }

    // Check rate limits
    const canSend = await this.rateLimiter.checkLimit(platform, 'send_message')
    if (!canSend) {
      const resetTime = this.rateLimiter.getResetTime(platform, 'send_message')
      return {
        success: false,
        error: `Rate limit exceeded. Resets at ${resetTime?.toISOString()}`,
        platform,
      }
    }

    try {
      const result = await service.sendMessage(recipientId, text, mediaUrls)
      
      // Update rate limits if headers are available (would need to be passed from service)
      // This is a simplified implementation
      
      return result
    } catch (error) {
      console.error(`Error sending message via ${platform}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
      }
    }
  }

  /**
   * Validate webhook for a specific platform
   */
  validateWebhook(
    platform: SocialPlatform,
    payload: string,
    signature: string,
    timestamp?: string
  ): boolean {
    const service = this.services.get(platform)
    if (!service) {
      return false
    }

    return service.validateWebhook(payload, signature, timestamp)
  }

  /**
   * Process inbound webhook for a specific platform
   */
  async processInboundWebhook(
    platform: SocialPlatform,
    payload: any
  ): Promise<UnifiedMessage | null> {
    const service = this.services.get(platform)
    if (!service) {
      return null
    }

    try {
      // Get the social media message
      const socialMessage = await service.processInboundWebhook(payload)
      if (!socialMessage) {
        return null
      }

      // Convert to unified message format
      const unifiedMessage = await this.convertSocialMessageToUnified(socialMessage)
      
      // Store the message
      const storedMessage = await messageService.storeMessage(unifiedMessage)
      
      return storedMessage
    } catch (error) {
      console.error(`Error processing ${platform} webhook:`, error)
      return null
    }
  }

  /**
   * Get user information from a specific platform
   */
  async getUserInfo(platform: SocialPlatform, userId: string): Promise<SocialUserInfo | null> {
    const service = this.services.get(platform)
    if (!service) {
      return null
    }

    // Check rate limits
    const canFetch = await this.rateLimiter.checkLimit(platform, 'get_user')
    if (!canFetch) {
      console.warn(`Rate limit exceeded for ${platform} user lookup`)
      return null
    }

    return service.getUserInfo(userId)
  }

  /**
   * Get message status from a specific platform
   */
  async getMessageStatus(platform: SocialPlatform, messageId: string): Promise<SocialMessageStatus | null> {
    const service = this.services.get(platform)
    if (!service) {
      return null
    }

    return service.getMessageStatus(messageId)
  }

  /**
   * Get rate limit information for a platform
   */
  getRateLimitInfo(platform: SocialPlatform, endpoint: string): {
    remaining: number
    resetTime: Date | null
  } {
    return {
      remaining: this.rateLimiter.getRemainingRequests(platform, endpoint),
      resetTime: this.rateLimiter.getResetTime(platform, endpoint),
    }
  }

  /**
   * Convert social media message to unified message format
   */
  private async convertSocialMessageToUnified(
    socialMessage: SocialMediaMessage
  ): Promise<UnifiedMessage> {
    // Map platform to channel type
    const channelType = socialMessage.platform === 'twitter' 
      ? ChannelType.TWITTER 
      : ChannelType.FACEBOOK

    // Create raw message for normalization
    const rawMessage: RawChannelMessage = {
      channel: channelType,
      externalId: socialMessage.externalId,
      direction: socialMessage.direction,
      timestamp: socialMessage.timestamp,
      rawData: {
        id: socialMessage.externalId,
        senderId: socialMessage.senderId,
        recipientId: socialMessage.recipientId,
        text: socialMessage.text,
        mediaUrls: socialMessage.mediaUrls,
        timestamp: socialMessage.timestamp.toISOString(),
        platform: socialMessage.platform,
        metadata: socialMessage.metadata,
      },
    }

    // Use the message service to normalize
    return messageService.normalizeMessage(rawMessage)
  }

  /**
   * Handle webhook challenge for platforms that require it
   */
  handleWebhookChallenge(
    platform: SocialPlatform,
    challengeData: any
  ): string | null {
    if (platform === 'twitter' && twitterService) {
      const service = twitterService as TwitterService
      return service.handleWebhookChallenge(challengeData.crc_token)
    }

    if (platform === 'facebook' && facebookService) {
      const service = facebookService as FacebookService
      return service.handleWebhookChallenge(
        challengeData.mode,
        challengeData.verify_token,
        challengeData.challenge
      )
    }

    return null
  }
}

// Export singleton instance
export const socialMediaService = new UnifiedSocialMediaService()