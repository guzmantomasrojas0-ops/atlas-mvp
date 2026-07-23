interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="border-border/70 bg-card/70 sticky top-0 z-10 flex h-16 shrink-0 items-center border-b px-6 backdrop-blur-xl sm:px-10">
      <div className="flex items-center gap-3">
        <div className="bg-brand-600 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold text-white md:hidden">
          A
        </div>
        <div>
          <h1 className="text-foreground text-[15px] font-semibold">{title}</h1>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      </div>
    </header>
  );
}
