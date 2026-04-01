import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function FieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-xs font-medium text-muted-foreground', className)}>
      {children}
    </label>
  )
}

export function FieldInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border-2 border-input bg-card/95 px-3.5 text-sm text-foreground shadow-inner shadow-foreground/[0.02] placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/25',
        className
      )}
      {...props}
    />
  )
}

export function FieldTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[88px] w-full resize-y rounded-2xl border-2 border-input bg-card/95 px-3.5 py-2.5 text-sm text-foreground shadow-inner shadow-foreground/[0.02] placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/25',
        className
      )}
      {...props}
    />
  )
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {children}
    </p>
  )
}
