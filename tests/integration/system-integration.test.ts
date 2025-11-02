/**
 * System Integration Tests
 * 
 * These tests validate that all system components work together correctly
 * and that the complete user journeys function as expected.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001 // Use different port for testing

let app: any
let server: any
let prisma: PrismaClient

beforeAll(async () => {
  // Initialize Next.js app for testing
  app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()
  
  await app.prepare()
  
  server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
  
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server ready on http://${hostname}:${port}`)
      resolve()
    })
  })
  
  // Initialize Prisma client
  prisma = new PrismaClient()
  
  // Clean up test database
  await cleanupTestData()
}, 30000)

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
  
  if (app) {
    await app.close()
  }
}, 10000)

async function cleanupTestData() {
  // Clean up test data in reverse dependency order
  await prisma.message.deleteMany({ where: { contactId: { contains: 'test-' } } })
  await prisma.note.deleteMany({ where: { contactId: { contains: 'test-' } } })
  await prisma.scheduledMessage.deleteMany({ where: { contactId: { contains: 'test-' } } })
  await prisma.contact.deleteMany({ where: { id: { contains: 'test-' } } })
  await prisma.user.deleteMany({ where: { email: { contains: 'test@' } } })
  await prisma.team.deleteMany({ where: { name: { contains: 'Test Team' } } })
}

describe('System Integration Tests', () => {
  describe('Health and Monitoring', () => {
    it('should provide comprehensive health status', async () => {
      const response = await request(`http://localhost:${port}`)
        .get('/api/health')
        .expect(200)
      
      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        services: {
          database: 'healthy'
        },
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number)
        }
      })
    })
    
    it('should provide Prometheus metrics', async () => {
      const response = await request(`http://localhost:${port}`)
        .get('/api/metrics')
        .expect(200)
      
      expect(response.headers['content-type']).toContain('text/plain')
      expect(response.text).toContain('app_info')
      expect(response.text).toContain('memory_usage_bytes')
      expect(response.text).toContain('total_messages')
    })
  })
  
  describe('Database Integration', () => {
    it('should handle database operations correctly', async () => {
      // Create test team
      const team = await prisma.team.create({
        data: {
          id: 'test-team-1',
          name: 'Test Team Integration',
          settings: {}
        }
      })
      
      // Create test user
      const user = await prisma.user.create({
        data: {
          id: 'test-user-1',
          email: 'test@integration.com',
          name: 'Test User',
          role: 'editor',
          teamId: team.id
        }
      })
      
      // Create test contact
      const contact = await prisma.contact.create({
        data: {
          id: 'test-contact-1',
          name: 'Test Contact',
          phone: '+1234567890',
          email: 'contact@test.com',
          teamId: team.id
        }
      })
      
      // Create test message
      const message = await prisma.message.create({
        data: {
          id: 'test-message-1',
          contactId: contact.id,
          userId: user.id,
          channel: 'sms',
          direction: 'inbound',
          content: { text: 'Test message' },
          status: 'delivered'
        }
      })
      
      // Verify all records were created
      expect(team.id).toBe('test-team-1')
      expect(user.email).toBe('test@integration.com')
      expect(contact.phone).toBe('+1234567890')
      expect(message.content).toEqual({ text: 'Test message' })
    })
  })
  
  describe('API Integration', () => {
    it('should handle authentication flow', async () => {
      // Test sign-in endpoint (should return validation error for invalid data)
      const response = await request(`http://localhost:${port}`)
        .post('/api/auth/signin')
        .send({
          email: 'invalid-email',
          password: 'short'
        })
      
      // Should return validation error, not server error
      expect([400, 401, 422]).toContain(response.status)
    })
    
    it('should handle contact management', async () => {
      // Test contacts endpoint (should require authentication)
      const response = await request(`http://localhost:${port}`)
        .get('/api/contacts')
      
      // Should return unauthorized, not server error
      expect([401, 403]).toContain(response.status)
    })
    
    it('should handle message operations', async () => {
      // Test messages endpoint (should require authentication)
      const response = await request(`http://localhost:${port}`)
        .get('/api/messages')
      
      // Should return unauthorized, not server error
      expect([401, 403]).toContain(response.status)
    })
  })
  
  describe('Cross-Channel Message Flow', () => {
    it('should normalize messages from different channels', async () => {
      // Create test data
      const team = await prisma.team.create({
        data: {
          id: 'test-team-2',
          name: 'Test Team Messages',
          settings: {}
        }
      })
      
      const user = await prisma.user.create({
        data: {
          id: 'test-user-2',
          email: 'test2@integration.com',
          name: 'Test User 2',
          role: 'editor',
          teamId: team.id
        }
      })
      
      const contact = await prisma.contact.create({
        data: {
          id: 'test-contact-2',
          name: 'Test Contact 2',
          phone: '+1234567891',
          email: 'contact2@test.com',
          teamId: team.id
        }
      })
      
      // Create messages from different channels
      const channels = ['sms', 'whatsapp', 'email', 'twitter'] as const
      const messages = await Promise.all(
        channels.map((channel, index) =>
          prisma.message.create({
            data: {
              id: `test-message-${channel}-${index}`,
              contactId: contact.id,
              userId: user.id,
              channel,
              direction: 'inbound',
              content: { text: `Test ${channel} message` },
              status: 'delivered'
            }
          })
        )
      )
      
      // Verify all messages were created with correct channels
      expect(messages).toHaveLength(4)
      messages.forEach((message, index) => {
        expect(message.channel).toBe(channels[index])
        expect(message.contactId).toBe(contact.id)
      })
      
      // Test message retrieval by contact
      const contactMessages = await prisma.message.findMany({
        where: { contactId: contact.id },
        orderBy: { timestamp: 'desc' }
      })
      
      expect(contactMessages).toHaveLength(4)
    })
  })
  
  describe('Real-time Collaboration', () => {
    it('should handle collaborative notes', async () => {
      // Create test data
      const team = await prisma.team.create({
        data: {
          id: 'test-team-3',
          name: 'Test Team Collaboration',
          settings: {}
        }
      })
      
      const users = await Promise.all([
        prisma.user.create({
          data: {
            id: 'test-user-3a',
            email: 'test3a@integration.com',
            name: 'Test User 3A',
            role: 'editor',
            teamId: team.id
          }
        }),
        prisma.user.create({
          data: {
            id: 'test-user-3b',
            email: 'test3b@integration.com',
            name: 'Test User 3B',
            role: 'editor',
            teamId: team.id
          }
        })
      ])
      
      const contact = await prisma.contact.create({
        data: {
          id: 'test-contact-3',
          name: 'Test Contact 3',
          phone: '+1234567892',
          teamId: team.id
        }
      })
      
      // Create notes from different users
      const notes = await Promise.all([
        prisma.note.create({
          data: {
            id: 'test-note-1',
            contactId: contact.id,
            userId: users[0].id,
            content: 'Note from user A',
            isPrivate: false
          }
        }),
        prisma.note.create({
          data: {
            id: 'test-note-2',
            contactId: contact.id,
            userId: users[1].id,
            content: 'Note from user B with @mention',
            isPrivate: false,
            mentions: [users[0].id]
          }
        })
      ])
      
      // Verify notes were created correctly
      expect(notes).toHaveLength(2)
      expect(notes[1].mentions).toContain(users[0].id)
      
      // Test note retrieval
      const contactNotes = await prisma.note.findMany({
        where: { contactId: contact.id },
        include: { user: true }
      })
      
      expect(contactNotes).toHaveLength(2)
      expect(contactNotes.map(n => n.user.name)).toContain('Test User 3A')
      expect(contactNotes.map(n => n.user.name)).toContain('Test User 3B')
    })
  })
  
  describe('Message Scheduling', () => {
    it('should handle scheduled messages correctly', async () => {
      // Create test data
      const team = await prisma.team.create({
        data: {
          id: 'test-team-4',
          name: 'Test Team Scheduling',
          settings: {}
        }
      })
      
      const user = await prisma.user.create({
        data: {
          id: 'test-user-4',
          email: 'test4@integration.com',
          name: 'Test User 4',
          role: 'editor',
          teamId: team.id
        }
      })
      
      const contact = await prisma.contact.create({
        data: {
          id: 'test-contact-4',
          name: 'Test Contact 4',
          phone: '+1234567893',
          teamId: team.id
        }
      })
      
      // Create scheduled message
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      
      const scheduledMessage = await prisma.scheduledMessage.create({
        data: {
          id: 'test-scheduled-1',
          contactId: contact.id,
          userId: user.id,
          channel: 'sms',
          content: { text: 'Scheduled test message' },
          scheduledFor: futureDate,
          status: 'pending'
        }
      })
      
      // Verify scheduled message
      expect(scheduledMessage.status).toBe('pending')
      expect(scheduledMessage.scheduledFor.getTime()).toBeGreaterThan(Date.now())
      
      // Test retrieval of pending scheduled messages
      const pendingMessages = await prisma.scheduledMessage.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date(Date.now() + 48 * 60 * 60 * 1000) }
        }
      })
      
      expect(pendingMessages).toContain(
        expect.objectContaining({ id: 'test-scheduled-1' })
      )
    })
  })
  
  describe('Analytics and Reporting', () => {
    it('should calculate metrics correctly', async () => {
      // Create test data for analytics
      const team = await prisma.team.create({
        data: {
          id: 'test-team-5',
          name: 'Test Team Analytics',
          settings: {}
        }
      })
      
      const user = await prisma.user.create({
        data: {
          id: 'test-user-5',
          email: 'test5@integration.com',
          name: 'Test User 5',
          role: 'editor',
          teamId: team.id
        }
      })
      
      const contacts = await Promise.all([
        prisma.contact.create({
          data: {
            id: 'test-contact-5a',
            name: 'Test Contact 5A',
            phone: '+1234567894',
            teamId: team.id
          }
        }),
        prisma.contact.create({
          data: {
            id: 'test-contact-5b',
            name: 'Test Contact 5B',
            phone: '+1234567895',
            teamId: team.id
          }
        })
      ])
      
      // Create messages for analytics
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      await Promise.all([
        // Messages from today
        prisma.message.create({
          data: {
            id: 'test-analytics-1',
            contactId: contacts[0].id,
            userId: user.id,
            channel: 'sms',
            direction: 'inbound',
            content: { text: 'Analytics test 1' },
            status: 'delivered',
            timestamp: now
          }
        }),
        prisma.message.create({
          data: {
            id: 'test-analytics-2',
            contactId: contacts[1].id,
            userId: user.id,
            channel: 'whatsapp',
            direction: 'outbound',
            content: { text: 'Analytics test 2' },
            status: 'delivered',
            timestamp: now
          }
        }),
        // Message from yesterday
        prisma.message.create({
          data: {
            id: 'test-analytics-3',
            contactId: contacts[0].id,
            userId: user.id,
            channel: 'email',
            direction: 'inbound',
            content: { text: 'Analytics test 3' },
            status: 'delivered',
            timestamp: yesterday
          }
        })
      ])
      
      // Test analytics queries
      const totalMessages = await prisma.message.count({
        where: { userId: user.id }
      })
      
      const todayMessages = await prisma.message.count({
        where: {
          userId: user.id,
          timestamp: { gte: new Date(now.toDateString()) }
        }
      })
      
      const messagesByChannel = await prisma.message.groupBy({
        by: ['channel'],
        _count: { id: true },
        where: { userId: user.id }
      })
      
      // Verify analytics
      expect(totalMessages).toBe(3)
      expect(todayMessages).toBe(2)
      expect(messagesByChannel).toHaveLength(3) // sms, whatsapp, email
      
      const channelCounts = messagesByChannel.reduce((acc, item) => {
        acc[item.channel] = item._count.id
        return acc
      }, {} as Record<string, number>)
      
      expect(channelCounts.sms).toBe(1)
      expect(channelCounts.whatsapp).toBe(1)
      expect(channelCounts.email).toBe(1)
    })
  })
})