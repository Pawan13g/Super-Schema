"use client";

import * as React from "react";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Menubar({
  className,
  ...props
}: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-7 items-center gap-0.5 rounded-md bg-transparent p-0",
        className
      )}
      {...props}
    />
  );
}

const MenubarMenu = MenuPrimitive.Root;
const MenubarPortal = MenuPrimitive.Portal;
const MenubarGroup = MenuPrimitive.Group;
const MenubarSub = MenuPrimitive.SubmenuRoot;

function MenubarTrigger({
  className,
  ...props
}: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        "flex h-6 cursor-default select-none items-center rounded-md px-2 text-xs font-medium outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: MenuPrimitive.Positioner.Props["align"];
  side?: MenuPrimitive.Positioner.Props["side"];
  sideOffset?: number;
}) {
  return (
    <MenubarPortal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} side={side}>
        <MenuPrimitive.Popup
          data-slot="menubar-content"
          className={cn(
            "z-50 min-w-[200px] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenubarPortal>
  );
}

function MenubarItem({
  className,
  destructive,
  inset,
  ...props
}: MenuPrimitive.Item.Props & {
  destructive?: boolean;
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.Item
      data-slot="menubar-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        destructive &&
          "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3.5" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenubarLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menubar-label"
      className={cn(
        "px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menubar-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto pl-4 text-[10px] tracking-wider text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menubar-sub-trigger"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function MenubarSubContent({
  className,
  ...props
}: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={4} align="start">
        <MenuPrimitive.Popup
          data-slot="menubar-sub-content"
          className={cn(
            "z-50 min-w-[180px] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
  MenubarGroup,
  MenubarPortal,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
