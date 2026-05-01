import { cn } from "@/lib/utils";
import type { HTMLAttributes, ImgHTMLAttributes } from "react";

function Avatar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      alt=""
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
