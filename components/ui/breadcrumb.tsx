import { cn } from "@/lib/utils";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      data-slot="breadcrumb"
      aria-label="breadcrumb"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1 break-words text-sm text-muted-foreground sm:gap-2",
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  className,
  children,
  href,
  ...props
}: ComponentProps<"a"> & { href?: string }) {
  const Comp = href ? "a" : "span";
  return (
    <Comp
      data-slot="breadcrumb-link"
      href={href}
      className={cn(
        "transition-colors hover:text-foreground",
        !href && "cursor-default",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
