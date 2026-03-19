import { RotateCcw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { useUpdate } from '@/contexts/UpdateContext'

export function UpdateButton() {
  const { status, version, progress, checkForUpdates, downloadUpdate, installUpdate } = useUpdate()

  if (status === 'idle' || status === 'browser') {
    return null
  }

  if (status === 'up-to-date') {
    return null
  }

  if (status === 'checking') {
    return (
      <Button variant="secondary" disabled className="h-10 w-48 gap-2">
        <Spinner className="size-4" />
        <span>Checking update</span>
      </Button>
    )
  }

  if (status === 'available') {
    return (
      <Button
        variant="default"
        onClick={downloadUpdate}
        className="h-10 w-48 gap-2"
      >
        <Download className="h-4 w-4" />
        Update to v{version}
      </Button>
    )
  }

  if (status === 'downloading') {
    return (
      <Button variant="secondary" disabled className="h-10 w-64 gap-2 px-3">
        <span className="w-24">Downloading</span>
        <Progress 
          value={progress} 
          className="flex-1 h-2 bg-black/20"
          indicatorClassName="bg-black"
        />
        <span className="text-sm w-10 text-right">{Math.round(progress)}%</span>
      </Button>
    )
  }

  if (status === 'ready-to-install') {
    return (
      <Button
        variant="default"
        onClick={installUpdate}
        className="h-10 w-48 gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Click to install
      </Button>
    )
  }

  if (status === 'error') {
    return (
      <Button
        variant="outline"
        onClick={checkForUpdates}
        className="h-10 w-48 gap-2"
      >
        Retry fetch update
      </Button>
    )
  }

  return null
}

export default UpdateButton