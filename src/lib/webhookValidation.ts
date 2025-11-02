import { NextRequest } from 'next/server'
import { twilioService } from '@/services/twilioService'
import { emailService } from '@/services/emailService'

export interface WebhookValidationResult {
  isValid: boolean
  error?: string
  payload?: string
}

/**
 * Validate Twilio webhook signature and extract payload
 */
export async function validateTwilioWebhook(
  request: NextRequest
): Promise<WebhookValidationResult> {
  try {
    // Get the raw body
    const payload = await request.text()
    const signature = request.headers.get('x-twilio-signature')
    const url = request.url

    if (!signature) {
      return {
        isValid: false,
        error: 'Missing Twilio signature header',
      }
    }

    if (!payload) {
      return {
        isValid: false,
        error: 'Empty request body',
      }
    }

    // Validate the signature
    const isValid = twilioService.validateWebhookSignature(payload, signature, url)

    if (!isValid) {
      return {
        isValid: false,
        error: 'Invalid Twilio signature',
      }
    }

    return {
      isValid: true,
      payload,
    }
  } catch (error) {
    console.error('Webhook validation error:', error)
    return {
      isValid: false,
      error: 'Webhook validation failed',
    }
  }
}

/**
 * Parse Twilio webhook form data
 */
export function parseTwilioWebhookPayload(body: string): Record<string, string> {
  const formData = new URLSearchParams(body)
  const payload: Record<string, string> = {}

  // Extract all form fields
  for (const [key, value] of formData.entries()) {
    payload[key] = value
  }

  return payload
}

/**
 * Validate required Twilio webhook fields
 */
export function validateTwilioWebhookFields(
  payload: Record<string, string>,
  requiredFields: string[]
): { isValid: boolean; missingFields?: string[] } {
  const missingFields = requiredFields.filter(field => !payload[field])

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
    }
  }

  return { isValid: true }
}

/**
 * Sanitize webhook payload for logging
 */
export function sanitizeWebhookPayload(payload: Record<string, string>): Record<string, string> {
  const sanitized = { ...payload }

  // Remove sensitive fields from logs
  const sensitiveFields = ['AccountSid', 'AuthToken']
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***'
    }
  })

  // Truncate long text fields
  if (sanitized.Body && sanitized.Body.length > 100) {
    sanitized.Body = sanitized.Body.substring(0, 100) + '...'
  }

  return sanitized
}

/**
 * Rate limiting for webhook endpoints
 */
export class WebhookRateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    // Get existing requests for this identifier
    const requests = this.requests.get(identifier) || []

    // Filter out old requests
    const recentRequests = requests.filter(time => time > windowStart)

    // Check if under limit
    if (recentRequests.length >= this.maxRequests) {
      return false
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)

    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const requests = this.requests.get(identifier) || []
    const recentRequests = requests.filter(time => time > windowStart)
    
    return Math.max(0, this.maxRequests - recentRequests.length)
  }

  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    return oldestRequest + this.windowMs
  }
}

/**
 * Validate email webhook signature and extract payload
 */
export async function validateEmailWebhook(
  request: NextRequest
): Promise<WebhookValidationResult> {
  try {
    // Get the raw body
    const payload = await request.text()
    const signature = request.headers.get('resend-signature') || request.headers.get('x-resend-signature')
    const timestamp = request.headers.get('resend-timestamp') || request.headers.get('x-resend-timestamp')

    if (!signature || !timestamp) {
      // If no signature headers, allow the request (some email services don't require signatures)
      return {
        isValid: true,
        payload,
      }
    }

    if (!payload) {
      return {
        isValid: false,
        error: 'Empty request body',
      }
    }

    // Validate the signature
    const isValid = emailService.validateWebhookSignature(payload, signature, timestamp)

    if (!isValid) {
      return {
        isValid: false,
        error: 'Invalid email webhook signature',
      }
    }

    return {
      isValid: true,
      payload,
    }
  } catch (error) {
    console.error('Email webhook validation error:', error)
    return {
      isValid: false,
      error: 'Email webhook validation failed',
    }
  }
}

/**
 * Parse email webhook JSON payload
 */
export function parseEmailWebhookPayload(body: string): any {
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error('Failed to parse email webhook payload:', error)
    throw new Error('Invalid JSON payload')
  }
}

/**
 * Validate required email webhook fields
 */
export function validateEmailWebhookFields(
  payload: any,
  requiredFields: string[]
): { isValid: boolean; missingFields?: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    if (field.includes('.')) {
      // Handle nested fields like 'data.email_id'
      const parts = field.split('.')
      let current = payload
      
      for (const part of parts) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          missingFields.push(field)
          break
        }
        current = current[part]
      }
    } else {
      // Handle top-level fields
      if (!payload[field]) {
        missingFields.push(field)
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
    }
  }

  return { isValid: true }
}

/**
 * Sanitize email webhook payload for logging
 */
export function sanitizeEmailWebhookPayload(payload: any): any {
  const sanitized = { ...payload }

  // Remove sensitive fields from logs
  const sensitiveFields = ['api_key', 'webhook_secret']
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***'
    }
  })

  // Truncate long content fields
  if (sanitized.data?.text && sanitized.data.text.length > 100) {
    sanitized.data.text = sanitized.data.text.substring(0, 100) + '...'
  }
  
  if (sanitized.data?.html && sanitized.data.html.length > 200) {
    sanitized.data.html = sanitized.data.html.substring(0, 200) + '...'
  }

  return sanitized
}

/**
 * Validate Twitter webhook signature and extract payload
 */
export async function validateTwitterWebhook(
  request: NextRequest
): Promise<WebhookValidationResult> {
  try {
    // Get the raw body
    const payload = await request.text()
    const signature = request.headers.get('x-twitter-webhooks-signature')
    
    if (!signature) {
      return {
        isValid: false,
        error: 'Missing Twitter signature header',
      }
    }

    if (!payload) {
      return {
        isValid: false,
        error: 'Empty request body',
      }
    }

    // Note: Twitter webhook validation would be handled by the Twitter service
    // This is a placeholder for the validation logic
    return {
      isValid: true,
      payload,
    }
  } catch (error) {
    console.error('Twitter webhook validation error:', error)
    return {
      isValid: false,
      error: 'Twitter webhook validation failed',
    }
  }
}

/**
 * Validate Facebook webhook signature and extract payload
 */
export async function validateFacebookWebhook(
  request: NextRequest
): Promise<WebhookValidationResult> {
  try {
    // Get the raw body
    const payload = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    
    if (!signature) {
      return {
        isValid: false,
        error: 'Missing Facebook signature header',
      }
    }

    if (!payload) {
      return {
        isValid: false,
        error: 'Empty request body',
      }
    }

    // Note: Facebook webhook validation would be handled by the Facebook service
    // This is a placeholder for the validation logic
    return {
      isValid: true,
      payload,
    }
  } catch (error) {
    console.error('Facebook webhook validation error:', error)
    return {
      isValid: false,
      error: 'Facebook webhook validation failed',
    }
  }
}

/**
 * Parse Twitter webhook JSON payload
 */
export function parseTwitterWebhookPayload(body: string): any {
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error('Failed to parse Twitter webhook payload:', error)
    throw new Error('Invalid JSON payload')
  }
}

/**
 * Parse Facebook webhook JSON payload
 */
export function parseFacebookWebhookPayload(body: string): any {
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error('Failed to parse Facebook webhook payload:', error)
    throw new Error('Invalid JSON payload')
  }
}

/**
 * Validate required Twitter webhook fields
 */
export function validateTwitterWebhookFields(
  payload: any,
  requiredFields: string[]
): { isValid: boolean; missingFields?: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    if (field.includes('.')) {
      // Handle nested fields
      const parts = field.split('.')
      let current = payload
      
      for (const part of parts) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          missingFields.push(field)
          break
        }
        current = current[part]
      }
    } else {
      // Handle top-level fields
      if (!payload[field]) {
        missingFields.push(field)
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
    }
  }

  return { isValid: true }
}

/**
 * Validate required Facebook webhook fields
 */
export function validateFacebookWebhookFields(
  payload: any,
  requiredFields: string[]
): { isValid: boolean; missingFields?: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    if (field.includes('.')) {
      // Handle nested fields like 'entry[0].messaging[0].message'
      const parts = field.split('.')
      let current = payload
      
      for (const part of parts) {
        if (part.includes('[') && part.includes(']')) {
          // Handle array access like 'entry[0]'
          const arrayName = part.split('[')[0]
          const index = parseInt(part.split('[')[1].split(']')[0])
          
          if (!current || !current[arrayName] || !Array.isArray(current[arrayName]) || 
              current[arrayName].length <= index) {
            missingFields.push(field)
            break
          }
          current = current[arrayName][index]
        } else {
          if (!current || typeof current !== 'object' || !(part in current)) {
            missingFields.push(field)
            break
          }
          current = current[part]
        }
      }
    } else {
      // Handle top-level fields
      if (!payload[field]) {
        missingFields.push(field)
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
    }
  }

  return { isValid: true }
}

/**
 * Sanitize Twitter webhook payload for logging
 */
export function sanitizeTwitterWebhookPayload(payload: any): any {
  const sanitized = { ...payload }

  // Remove sensitive fields from logs
  const sensitiveFields = ['access_token', 'api_key']
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***'
    }
  })

  // Truncate long text fields
  if (sanitized.direct_message_events) {
    sanitized.direct_message_events = sanitized.direct_message_events.map((event: any) => ({
      ...event,
      message_create: {
        ...event.message_create,
        message_data: {
          ...event.message_create?.message_data,
          text: event.message_create?.message_data?.text?.length > 100 
            ? event.message_create.message_data.text.substring(0, 100) + '...'
            : event.message_create?.message_data?.text
        }
      }
    }))
  }

  return sanitized
}

/**
 * Sanitize Facebook webhook payload for logging
 */
export function sanitizeFacebookWebhookPayload(payload: any): any {
  const sanitized = { ...payload }

  // Remove sensitive fields from logs
  const sensitiveFields = ['access_token', 'app_secret']
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***'
    }
  })

  // Truncate long text fields in messaging events
  if (sanitized.entry) {
    sanitized.entry = sanitized.entry.map((entry: any) => ({
      ...entry,
      messaging: entry.messaging?.map((msg: any) => ({
        ...msg,
        message: msg.message ? {
          ...msg.message,
          text: msg.message.text?.length > 100 
            ? msg.message.text.substring(0, 100) + '...'
            : msg.message.text
        } : msg.message
      }))
    }))
  }

  return sanitized
}

// Global rate limiter instance
export const webhookRateLimiter = new WebhookRateLimiter()