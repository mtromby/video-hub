import { useState } from 'react'

import { cn } from '@/lib/utils'

const sizeClass = {
  sm: 'size-5 text-[9px]',
  md: 'size-7 text-[10px]',
  lg: 'size-16 text-lg sm:size-20 sm:text-xl',
} as const

type PerformerAvatarProps = {
  name: string
  imageUrl?: string | null
  size?: keyof typeof sizeClass
  className?: string
}

export function PerformerAvatar({ name, imageUrl, size = 'md', className }: PerformerAvatarProps) {
  const [broken, setBroken] = useState(false)
  const showImg = Boolean(imageUrl?.trim()) && !broken
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-600/40 to-violet-600/35 font-semibold text-white ring-1 ring-white/15',
        sizeClass[size],
        className
      )}
    >
      {showImg ? (
        <img
          src={imageUrl!.trim()}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="select-none" aria-hidden>
          {initials}
        </span>
      )}
    </span>
  )
}
