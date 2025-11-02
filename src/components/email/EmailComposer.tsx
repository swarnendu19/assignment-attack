'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Paperclip, 
  Send, 
  X, 
  FileText, 
  Image as ImageIcon,
  AlertCircle,
  Loader2 
} from 'lucide-react'

interface EmailAttachment {
  file: File
  preview?: string
}

interface EmailComposerProps {
  to?: string
  subject?: string
  replyTo?: string
  conversationId?: string
  contactId?: string
  onSend?: (emailData: EmailSendData) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export interface EmailSendData {
  to: string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: string // base64
    contentType: string
  }>
  contactId?: string
  conversationId?: string
}

export function EmailComposer({
  to = '',
  subject = '',
  replyTo,
  conversationId,
  contactId,
  onSend,
  onCancel,
  isLoading = false,
}: EmailComposerProps) {
  const [recipients, setRecipients] = useState<string[]>(to ? [to] : [])
  const [emailSubject, setEmailSubject] = useState(subject)
  const [textContent, setTextContent] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [replyToEmail, setReplyToEmail] = useState(replyTo || '')
  const [attachments, setAttachments] = useState<EmailAttachment[]>([])
  const [activeTab, setActiveTab] = useState<'text' | 'html'>('text')
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAddRecipient = (email: string) => {
    const trimmedEmail = email.trim()
    if (trimmedEmail && validateEmail(trimmedEmail) && !recipients.includes(trimmedEmail)) {
      setRecipients([...recipients, trimmedEmail])
      setErrors({ ...errors, recipients: '' })
    }
  }

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email))
  }

  const handleRecipientKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const email = e.currentTarget.value.trim()
      if (email) {
        handleAddRecipient(email)
        e.currentTarget.value = ''
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    files.forEach(file => {
      // Check file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        setErrors({ ...errors, attachments: `File ${file.name} is too large (max 25MB)` })
        return
      }

      const attachment: EmailAttachment = { file }

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string
          setAttachments(prev => [...prev, attachment])
        }
        reader.readAsDataURL(file)
      } else {
        setAttachments(prev => [...prev, attachment])
      }
    })

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (recipients.length === 0) {
      newErrors.recipients = 'At least one recipient is required'
    }

    if (!emailSubject.trim()) {
      newErrors.subject = 'Subject is required'
    }

    if (!textContent.trim() && !htmlContent.trim()) {
      newErrors.content = 'Email content is required'
    }

    if (replyToEmail && !validateEmail(replyToEmail)) {
      newErrors.replyTo = 'Invalid reply-to email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSend = async () => {
    if (!validateForm() || !onSend) return

    try {
      // Convert attachments to base64
      const attachmentPromises = attachments.map(async (att) => {
        return new Promise<{ filename: string; content: string; contentType: string }>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1] // Remove data:type;base64, prefix
            resolve({
              filename: att.file.name,
              content: base64,
              contentType: att.file.type,
            })
          }
          reader.readAsDataURL(att.file)
        })
      })

      const processedAttachments = await Promise.all(attachmentPromises)

      const emailData: EmailSendData = {
        to: recipients,
        subject: emailSubject,
        text: textContent || undefined,
        html: htmlContent || undefined,
        replyTo: replyToEmail || undefined,
        attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
        contactId,
        conversationId,
      }

      await onSend(emailData)
    } catch (error) {
      console.error('Failed to send email:', error)
      setErrors({ general: 'Failed to send email. Please try again.' })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Compose Email</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipients */}
        <div className="space-y-2">
          <Label htmlFor="recipients">To</Label>
          <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
            {recipients.map((email) => (
              <Badge key={email} variant="secondary" className="flex items-center gap-1">
                {email}
                <button
                  onClick={() => handleRemoveRecipient(email)}
                  className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              placeholder="Enter email addresses..."
              className="border-none shadow-none flex-1 min-w-[200px]"
              onKeyDown={handleRecipientKeyPress}
              onBlur={(e) => {
                const email = e.target.value.trim()
                if (email) {
                  handleAddRecipient(email)
                  e.target.value = ''
                }
              }}
            />
          </div>
          {errors.recipients && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.recipients}
            </p>
          )}
        </div>

        {/* Reply-To */}
        <div className="space-y-2">
          <Label htmlFor="replyTo">Reply-To (optional)</Label>
          <Input
            id="replyTo"
            type="email"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            placeholder="reply@example.com"
          />
          {errors.replyTo && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.replyTo}
            </p>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Email subject..."
          />
          {errors.subject && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.subject}
            </p>
          )}
        </div>

        {/* Content Tabs */}
        <div className="space-y-2">
          <Label>Content</Label>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'text' | 'html')}>
            <TabsList>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Write your email message..."
                rows={10}
                className="resize-none"
              />
            </TabsContent>
            <TabsContent value="html">
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<p>Write your HTML email content...</p>"
                rows={10}
                className="resize-none font-mono text-sm"
              />
            </TabsContent>
          </Tabs>
          {errors.content && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.content}
            </p>
          )}
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Attachments</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Add Files
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center gap-3 p-2 border rounded-md">
                  {attachment.preview ? (
                    <img
                      src={attachment.preview}
                      alt={attachment.file.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                      {attachment.file.type.startsWith('image/') ? (
                        <ImageIcon className="h-5 w-5 text-gray-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{attachment.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.file.size)} • {attachment.file.type}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(index)}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {errors.attachments && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.attachments}
            </p>
          )}
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.general}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={isLoading || recipients.length === 0 || !emailSubject.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}