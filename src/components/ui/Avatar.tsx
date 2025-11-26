import * as React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
}

export function Avatar({
  src,
  alt = '',
  fallback,
  size = 'md',
  className,
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = React.useState(false)

  const initials = React.useMemo(() => {
    if (fallback) return fallback.slice(0, 2).toUpperCase()
    if (alt) {
      return alt
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }
    return '?'
  }, [fallback, alt])

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-beige overflow-hidden',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-medium text-earthTone">{initials}</span>
      )}
    </div>
  )
}
