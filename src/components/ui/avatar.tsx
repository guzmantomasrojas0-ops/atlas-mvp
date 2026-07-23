import { getColorForId } from "@/lib/colors";
import { cn } from "@/lib/cn";

interface AvatarProps {
  /** Usado para elegir un color estable — no es necesariamente el mismo `id` de negocio que se muestra. */
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar circular con las iniciales del nombre — todavía no hay fotos reales de ningún canal. */
export function Avatar({ id, name, size = "md", className }: AvatarProps) {
  const color = getColorForId(id);
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZE_CLASSES[size],
        color.bg,
        color.text,
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
