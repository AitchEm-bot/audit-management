'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { useLanguage } from '@/contexts/language-context'
import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const { locale } = useLanguage()
  const isRTL = locale === 'ar'

  // In RTL mode, we need to flip the entire container so the progress fills from right to left
  const containerTransform = isRTL ? 'scaleX(-1)' : 'none'
  const translateValue = `translateX(-${100 - (value || 0)}%)`

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        className,
      )}
      style={{ transform: containerTransform }}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: translateValue }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
