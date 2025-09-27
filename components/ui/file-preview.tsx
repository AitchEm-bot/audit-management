"use client"

import { useState } from "react"
import { FileText, Image, FileIcon, Eye, EyeOff, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface FilePreviewProps {
  file?: File
  url?: string
  fileName?: string
  showPreview?: boolean
  className?: string
}

export function FilePreview({
  file,
  url,
  fileName,
  showPreview = true,
  className = ""
}: FilePreviewProps) {
  const [imageError, setImageError] = useState(false)
  const [isPreviewVisible, setIsPreviewVisible] = useState(showPreview)
  const [imageKey, setImageKey] = useState(0) // Force re-render

  const displayName = fileName || file?.name || "Unknown file"
  const fileType = file?.type || url?.split('.').pop() || ""
  const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(displayName)
  const isCSV = fileType.includes('csv') || displayName.endsWith('.csv')

  const getFileIcon = () => {
    if (isImage) return <Image className="h-8 w-8 text-blue-500" />
    if (isCSV) return <FileText className="h-8 w-8 text-green-500" />
    return <FileIcon className="h-8 w-8 text-gray-500" />
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const handleRetry = () => {
    setImageError(false)
    setImageKey(prev => prev + 1) // Force re-render
  }

  const previewUrl = file ? URL.createObjectURL(file) : url

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getFileIcon()}
            <div>
              <p className="font-medium text-sm truncate max-w-48">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {file?.size ? `${(file.size / 1024).toFixed(1)} KB` : 'External file'}
              </p>
            </div>
          </div>

          {isImage && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewVisible(!isPreviewVisible)}
              >
                {isPreviewVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {imageError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetry}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Image Preview with Error Handling */}
        {isImage && isPreviewVisible && previewUrl && (
          <div className="relative">
            {imageError ? (
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <div className="text-center">
                  <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load image</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <img
                key={imageKey}
                src={previewUrl}
                alt={displayName}
                className="w-full h-32 object-cover rounded-lg border"
                onError={handleImageError}
                loading="lazy"
                onLoad={() => setImageError(false)}
              />
            )}
          </div>
        )}

        {/* CSV Preview */}
        {isCSV && isPreviewVisible && (
          <div className="bg-muted/30 rounded-lg p-3 border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">CSV File Ready</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Click upload to process this CSV file
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Cleanup function for file URLs
export function cleanupFilePreview(file?: File) {
  if (file) {
    const url = URL.createObjectURL(file)
    URL.revokeObjectURL(url)
  }
}