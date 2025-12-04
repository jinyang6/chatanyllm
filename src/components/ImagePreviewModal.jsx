import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import { useState } from 'react'

export function ImagePreviewModal({ imageUrl, imageName, isOpen, onClose, onDownload }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!imageUrl || !onDownload) return

    setIsDownloading(true)
    try {
      await onDownload(imageUrl, imageName)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold">
            {imageName || 'Image Preview'}
          </DialogTitle>
        </DialogHeader>

        {/* Image Container */}
        <div className="flex items-center justify-center p-6 overflow-auto max-h-[70vh]">
          <img
            src={imageUrl}
            alt={imageName || 'Preview'}
            className="max-w-full max-h-full object-contain rounded-lg"
            loading="lazy"
          />
        </div>

        {/* Footer with Download Button */}
        <DialogFooter className="px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="mr-2"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
