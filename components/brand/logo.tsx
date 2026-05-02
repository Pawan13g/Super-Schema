import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  // Square pixel size of the rendered mark. Default 24.
  size?: number;
  alt?: string;
}

// Single source of truth for the Super Schema brand mark. Reads
// /public/logo.svg so a swap there propagates everywhere. Use this for any
// header/auth-card/landing-nav placement.
export function Logo({ className, size = 24, alt = "Super Schema" }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt={alt}
      width={size}
      height={size}
      priority
      className={cn("shrink-0 select-none", className)}
    />
  );
}
