import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/services/analyticsService'
import { ExportRequestSchema } from '@/types/analytics'
import { auth } from '@/lib/auth'
import { createObjectCsvWriter } from 'csv-writer'
import PDFDocument from 'pdfkit'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    
    // Validate export request
    const exportRequest = ExportRequestSchema.parse({
      ...body,
      query: {
        ...body.query,
        dateRange: {
          startDate: new Date(body.query.dateRange.startDate),
          endDate: new Date(body.query.dateRange.endDate)
        },
        teamId: session.user.teamId
      }
    })

    // Get analytics data
    const metrics = await analyticsService.getAnalyticsMetrics(exportRequest.query)

    // Generate export file based on format
    let exportResult
    switch (exportRequest.format) {
      case 'csv':
        exportResult = await generateCSVExport(metrics, exportRequest)
        break
      case 'pdf':
        exportResult = await generatePDFExport(metrics, exportRequest)
        break
      case 'json':
        exportResult = await generateJSONExport(metrics, exportRequest)
        break
      default:
        throw new Error('Unsupported export format')
    }

    return NextResponse.json({
      success: true,
      data: exportResult
    })

  } catch (error) {
    console.error('Analytics export API error:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid export request', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateCSVExport(metrics: any, request: any) {
  const fileName = request.fileName || `analytics-export-${Date.now()}.csv`
  const filePath = path.join(process.cwd(), 'tmp', fileName)

  // Ensure tmp directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  // Prepare data for CSV
  const csvData = []

  // Add response time metrics
  if (request.metrics.includes('responseTime')) {
    csvData.push({
      metric: 'Average Response Time',
      value: metrics.responseTime.averageResponseTime,
      unit: 'minutes'
    })
    csvData.push({
      metric: 'Median Response Time',
      value: metrics.responseTime.medianResponseTime,
      unit: 'minutes'
    })
    csvData.push({
      metric: 'First Response Time',
      value: metrics.responseTime.firstResponseTime,
      unit: 'minutes'
    })
  }

  // Add message volume metrics
  if (request.metrics.includes('messageVolume')) {
    csvData.push({
      metric: 'Total Messages',
      value: metrics.messageVolume.totalMessages,
      unit: 'count'
    })
    csvData.push({
      metric: 'Inbound Messages',
      value: metrics.messageVolume.inboundMessages,
      unit: 'count'
    })
    csvData.push({
      metric: 'Outbound Messages',
      value: metrics.messageVolume.outboundMessages,
      unit: 'count'
    })
  }

  // Add engagement metrics
  if (request.metrics.includes('engagement')) {
    csvData.push({
      metric: 'Total Conversations',
      value: metrics.engagement.totalConversations,
      unit: 'count'
    })
    csvData.push({
      metric: 'Active Conversations',
      value: metrics.engagement.activeConversations,
      unit: 'count'
    })
    csvData.push({
      metric: 'Resolution Rate',
      value: (metrics.engagement.conversationResolutionRate * 100).toFixed(2),
      unit: 'percentage'
    })
  }

  // Add conversion metrics
  if (request.metrics.includes('conversion')) {
    csvData.push({
      metric: 'Total Leads',
      value: metrics.conversionFunnel.totalLeads,
      unit: 'count'
    })
    csvData.push({
      metric: 'Qualified Leads',
      value: metrics.conversionFunnel.qualifiedLeads,
      unit: 'count'
    })
    csvData.push({
      metric: 'Overall Conversion Rate',
      value: (metrics.conversionFunnel.conversionRates.overallConversion * 100).toFixed(2),
      unit: 'percentage'
    })
  }

  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'metric', title: 'Metric' },
      { id: 'value', title: 'Value' },
      { id: 'unit', title: 'Unit' }
    ]
  })

  // Write CSV file
  await csvWriter.writeRecords(csvData)

  // Get file stats
  const stats = await fs.stat(filePath)

  return {
    fileName,
    downloadUrl: `/api/analytics/download/${fileName}`,
    fileSize: stats.size,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}

async function generatePDFExport(metrics: any, request: any) {
  const fileName = request.fileName || `analytics-export-${Date.now()}.pdf`
  const filePath = path.join(process.cwd(), 'tmp', fileName)

  // Ensure tmp directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  // Create PDF document
  const doc = new PDFDocument()
  const stream = require('fs').createWriteStream(filePath)
  doc.pipe(stream)

  // Add title
  doc.fontSize(20).text('Analytics Report', 50, 50)
  doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80)
  doc.text(`Period: ${request.query.dateRange.startDate} to ${request.query.dateRange.endDate}`, 50, 100)

  let yPosition = 140

  // Add response time metrics
  if (request.metrics.includes('responseTime')) {
    doc.fontSize(16).text('Response Time Metrics', 50, yPosition)
    yPosition += 30
    
    doc.fontSize(12)
      .text(`Average Response Time: ${metrics.responseTime.averageResponseTime.toFixed(2)} minutes`, 70, yPosition)
    yPosition += 20
    doc.text(`Median Response Time: ${metrics.responseTime.medianResponseTime.toFixed(2)} minutes`, 70, yPosition)
    yPosition += 20
    doc.text(`First Response Time: ${metrics.responseTime.firstResponseTime.toFixed(2)} minutes`, 70, yPosition)
    yPosition += 40
  }

  // Add message volume metrics
  if (request.metrics.includes('messageVolume')) {
    doc.fontSize(16).text('Message Volume Metrics', 50, yPosition)
    yPosition += 30
    
    doc.fontSize(12)
      .text(`Total Messages: ${metrics.messageVolume.totalMessages}`, 70, yPosition)
    yPosition += 20
    doc.text(`Inbound Messages: ${metrics.messageVolume.inboundMessages}`, 70, yPosition)
    yPosition += 20
    doc.text(`Outbound Messages: ${metrics.messageVolume.outboundMessages}`, 70, yPosition)
    yPosition += 40
  }

  // Add engagement metrics
  if (request.metrics.includes('engagement')) {
    doc.fontSize(16).text('Engagement Metrics', 50, yPosition)
    yPosition += 30
    
    doc.fontSize(12)
      .text(`Total Conversations: ${metrics.engagement.totalConversations}`, 70, yPosition)
    yPosition += 20
    doc.text(`Active Conversations: ${metrics.engagement.activeConversations}`, 70, yPosition)
    yPosition += 20
    doc.text(`Resolution Rate: ${(metrics.engagement.conversationResolutionRate * 100).toFixed(2)}%`, 70, yPosition)
    yPosition += 40
  }

  // Add conversion metrics
  if (request.metrics.includes('conversion')) {
    doc.fontSize(16).text('Conversion Metrics', 50, yPosition)
    yPosition += 30
    
    doc.fontSize(12)
      .text(`Total Leads: ${metrics.conversionFunnel.totalLeads}`, 70, yPosition)
    yPosition += 20
    doc.text(`Qualified Leads: ${metrics.conversionFunnel.qualifiedLeads}`, 70, yPosition)
    yPosition += 20
    doc.text(`Overall Conversion Rate: ${(metrics.conversionFunnel.conversionRates.overallConversion * 100).toFixed(2)}%`, 70, yPosition)
  }

  // Finalize PDF
  doc.end()

  // Wait for PDF to be written
  await new Promise((resolve) => {
    stream.on('finish', resolve)
  })

  // Get file stats
  const stats = await fs.stat(filePath)

  return {
    fileName,
    downloadUrl: `/api/analytics/download/${fileName}`,
    fileSize: stats.size,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}

async function generateJSONExport(metrics: any, request: any) {
  const fileName = request.fileName || `analytics-export-${Date.now()}.json`
  const filePath = path.join(process.cwd(), 'tmp', fileName)

  // Ensure tmp directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  // Prepare export data
  const exportData = {
    generatedAt: new Date().toISOString(),
    period: {
      startDate: request.query.dateRange.startDate,
      endDate: request.query.dateRange.endDate
    },
    metrics: {}
  }

  // Add requested metrics
  if (request.metrics.includes('responseTime')) {
    exportData.metrics.responseTime = metrics.responseTime
  }
  if (request.metrics.includes('messageVolume')) {
    exportData.metrics.messageVolume = metrics.messageVolume
  }
  if (request.metrics.includes('engagement')) {
    exportData.metrics.engagement = metrics.engagement
  }
  if (request.metrics.includes('conversion')) {
    exportData.metrics.conversion = metrics.conversionFunnel
  }
  if (request.metrics.includes('channelPerformance')) {
    exportData.metrics.channelPerformance = metrics.channelPerformance
  }
  if (request.metrics.includes('teamPerformance')) {
    exportData.metrics.teamPerformance = metrics.teamPerformance
  }

  // Write JSON file
  await fs.writeFile(filePath, JSON.stringify(exportData, null, 2))

  // Get file stats
  const stats = await fs.stat(filePath)

  return {
    fileName,
    downloadUrl: `/api/analytics/download/${fileName}`,
    fileSize: stats.size,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}