type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="max-w-sm text-sm text-zinc-400">{description}</p>
    </div>
  )
}
