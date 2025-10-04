"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileIcon, Trash2, Image as ImageIcon, Video, FileText, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { deleteAttachment } from "@/app/tickets/[id]/actions"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useTranslation } from "@/lib/translations"

interface Attachment {
  id: string
  filename: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}

interface AttachmentDisplayProps {
  attachments: Attachment[]
  canDelete?: boolean
  activityId: string
  isEditing?: boolean
  hasContent?: boolean
}

export function AttachmentDisplay({ attachments, canDelete = false, activityId, isEditing = false, hasContent = true }: AttachmentDisplayProps) {
  const router = useRouter()
  const { locale } = useLanguage()
  const { t } = useTranslation(locale)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />
    } else if (mimeType.startsWith('video/')) {
      return <Video className="h-4 w-4" />
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4" />
    } else {
      return <FileIcon className="h-4 w-4" />
    }
  }

  const getPublicUrl = useCallback(async (filePath: string) => {
    console.log('[AttachmentDisplay] getPublicUrl called for:', filePath)

    if (previewUrls[filePath]) {
      console.log('[AttachmentDisplay] Returning cached URL for:', filePath)
      return previewUrls[filePath]
    }

    console.log('[AttachmentDisplay] Creating API request for signed URL:', filePath)
    try {
      // Use API route instead of direct Supabase client to avoid session issues
      const response = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath }),
      })

      console.log('[AttachmentDisplay] API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[AttachmentDisplay] API error:', errorText)
        return null
      }

      const { url } = await response.json()
      console.log('[AttachmentDisplay] Got signed URL from API:', url ? 'Success' : 'Failed')

      if (url) {
        setPreviewUrls(prev => ({ ...prev, [filePath]: url }))
        return url
      }

      return null
    } catch (err) {
      console.error('[AttachmentDisplay] Exception in getPublicUrl:', err)
      return null
    }
  }, [previewUrls])

  const handleDownload = async (attachment: Attachment) => {
    const url = await getPublicUrl(attachment.file_path)
    if (!url) return

    try {
      // Fetch the file as a blob to force download
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = attachment.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Failed to download file')
    }
  }

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(t('tickets.removeAttachment') + '?')) {
      return
    }

    setDeletingId(attachment.id)
    try {
      const result = await deleteAttachment(attachment.id, attachment.file_path)
      if (result?.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
      alert('Failed to delete attachment')
    } finally {
      setDeletingId(null)
    }
  }

  const renderPreview = async (attachment: Attachment) => {
    const url = await getPublicUrl(attachment.file_path)
    if (!url) return null

    if (attachment.mime_type.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img
            src={url}
            alt={attachment.filename}
            className="max-w-md max-h-64 rounded border"
          />
        </div>
      )
    } else if (attachment.mime_type.startsWith('video/')) {
      return (
        <div className="mt-2">
          <video
            controls
            className="max-w-md max-h-64 rounded border"
          >
            <source src={url} type={attachment.mime_type} />
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }
    return null
  }

  if (attachments.length === 0) {
    return null
  }

  return (
    <>
      <div className={`space-y-2 ${hasContent ? 'mt-3 pt-3 border-t' : ''}`}>
        <div className="text-xs font-medium text-gray-600">
          {t('tickets.attachments')} ({attachments.length})
        </div>
        {attachments.map((attachment) => (
          <div key={attachment.id} className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-white rounded border">
              {getFileIcon(attachment.mime_type)}
              <span className="text-sm flex-1 truncate">{attachment.filename}</span>
              <span className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</span>
              {isEditing && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="h-7 text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {t('tickets.downloadAttachment')}
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(attachment)}
                      disabled={deletingId === attachment.id}
                      className="h-7 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {deletingId === attachment.id ? t('tickets.deleting') : t('common.delete')}
                    </Button>
                  )}
                </>
              )}
            </div>
            {/* Preview for images and videos */}
            {(attachment.mime_type.startsWith('image/') || attachment.mime_type.startsWith('video/')) && (
              <div className="pl-6">
                <PreviewContent
                  attachment={attachment}
                  getPublicUrl={getPublicUrl}
                  onImageClick={setLightboxImage}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox for full-size image viewing */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-in"
              onClick={(e) => {
                e.stopPropagation()
                // Allow browser's native zoom on click
              }}
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded">
              {lightboxImage.name}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Separate component to handle async preview rendering
function PreviewContent({
  attachment,
  getPublicUrl,
  onImageClick
}: {
  attachment: Attachment
  getPublicUrl: (path: string) => Promise<string | null>
  onImageClick?: (image: { url: string; name: string }) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    console.log('[PreviewContent] Component mounted for:', attachment.filename, 'Path:', attachment.file_path)
    console.log('[PreviewContent] MIME type:', attachment.mime_type)

    getPublicUrl(attachment.file_path).then(fetchedUrl => {
      console.log('[PreviewContent] URL fetched:', fetchedUrl ? 'Success' : 'Failed', 'for:', attachment.filename)
      if (fetchedUrl) {
        console.log('[PreviewContent] Setting URL state to:', fetchedUrl)
      }
      setUrl(fetchedUrl)
    })
  }, [attachment.file_path, attachment.filename, attachment.mime_type, getPublicUrl])

  if (!url) {
    console.log('[PreviewContent] No URL available yet for:', attachment.filename)
    return null
  }

  console.log('[PreviewContent] Rendering preview for:', attachment.filename, 'with URL:', url)

  if (attachment.mime_type.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={attachment.filename}
        className="max-w-md max-h-64 rounded border cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onImageClick?.({ url, name: attachment.filename })}
        onLoad={() => {
          console.log('[PreviewContent] Image loaded successfully:', attachment.filename)
          setLoadError(false)
        }}
        onError={(e) => {
          console.error('[PreviewContent] Image failed to load:', attachment.filename)
          console.error('[PreviewContent] Image src:', url)
          console.error('[PreviewContent] Error event:', e)
          setLoadError(true)
        }}
      />
    )
  } else if (attachment.mime_type.startsWith('video/')) {
    return (
      <video
        controls
        className="max-w-md max-h-64 rounded border"
        onLoadedData={() => {
          console.log('[PreviewContent] Video loaded successfully:', attachment.filename)
        }}
        onError={(e) => {
          console.error('[PreviewContent] Video failed to load:', attachment.filename)
          console.error('[PreviewContent] Video src:', url)
          console.error('[PreviewContent] Error event:', e)
        }}
      >
        <source src={url} type={attachment.mime_type} />
        Your browser does not support the video tag.
      </video>
    )
  }

  return null
}
