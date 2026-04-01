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
    <label
      htmlFor={htmlFor}
      className={cn('block text-xs font-medium text-zinc-400', className)}
    >
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
        'h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600 outline-none ring-violet-500/40 focus-visible:ring-2',
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
        'min-h-[88px] w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none ring-violet-500/40 focus-visible:ring-2',
        className
      )}
      {...props}
    />
  )
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="text-xs text-red-400" role="alert">
      {children}
    </p>
  )
}
