"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCog } from "lucide-react";

type Variant = "compact" | "full";

interface UserMenuProps {
  variant?: Variant;
}

export function UserMenu({ variant = "compact" }: UserMenuProps) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const displayName = session.user.name ?? "Account";
  const email = session.user.email ?? "";
  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const trigger =
    variant === "full" ? (
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{displayName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{email}</p>
        </div>
      </button>
    ) : (
      <button
        type="button"
        title={email || displayName}
        className="rounded-full outline-none ring-2 ring-transparent transition-all hover:ring-border focus-visible:ring-ring"
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align={variant === "full" ? "start" : "end"}
        side={variant === "full" ? "top" : "bottom"}
        sideOffset={6}
        className="min-w-[220px]"
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {email ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {email}
            </p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <UserCog />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
