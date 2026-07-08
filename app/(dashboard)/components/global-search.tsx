"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

interface RouteSubLink {
  title: string;
  href: string;
  icon?: React.ElementType;
}

interface RouteItem {
  title: string;
  href: string;
  icon?: React.ElementType;
  group?: string;
  subLinks?: RouteSubLink[];
}

interface GlobalSearchProps {
  routes: RouteItem[];
}

export function GlobalSearch({ routes }: GlobalSearchProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  // Group routes by their assigned category
  const groupedRoutes = React.useMemo(() => {
    const groups = new Map<string, RouteItem[]>();
    routes.forEach((route) => {
      const groupName = route.group || "General Navigation";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)?.push(route);
    });
    return groups;
  }, [routes]);

  return (
    <>
      <Button
        variant="outline"
        className={[
          // Layout
          "group relative h-9 w-full justify-start",
          "sm:pr-12 md:w-40 lg:w-64",
          // Shape
          "rounded-lg",
          // Colors — subtle inset look
          "border border-border/60 bg-background/60 backdrop-blur-sm",
          "hover:border-border hover:bg-accent/40",
          // Text
          "text-sm font-normal text-muted-foreground/70 hover:text-muted-foreground",
          // Shadow & transition
          "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
          "transition-all duration-200 ease-out",
          "focus-visible:ring-1 focus-visible:ring-ring/50",
        ].join(" ")}
        onClick={() => setOpen(true)}
      >
        {/* Search icon with subtle colour shift on hover */}
        <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors duration-200 group-hover:text-muted-foreground/80" />

        <span className="inline-flex truncate">Search dashboard…</span>

        {/* Keyboard shortcut badge */}
        <kbd
          className={[
            "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2",
            "hidden h-5 select-none items-center gap-0.5 sm:flex",
            "rounded-[5px] border border-border/60 bg-muted/60 px-1.5",
            "font-mono text-[10px] font-medium tracking-tight text-muted-foreground/60",
            "transition-colors duration-200 group-hover:border-border/80 group-hover:text-muted-foreground/80",
          ].join(" ")}
        >
          <span className="text-[11px] leading-none">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search or jump to…"
          className="text-sm"
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground/60">
            No results found.
          </CommandEmpty>

          {Array.from(groupedRoutes.entries()).map(([groupName, groupRoutes]) => (
            <CommandGroup
              key={groupName}
              heading={groupName}
              className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/50"
            >
              {groupRoutes.map((route) => {
                const Icon = route.icon;
                return (
                  <React.Fragment key={route.href}>
                    <CommandItem
                      value={`${groupName} ${route.title}`}
                      onSelect={() => {
                        runCommand(() => router.push(route.href));
                      }}
                      className={[
                        "group/item cursor-pointer rounded-md",
                        "gap-2.5 px-3 py-2.5 mt-0.5",
                        "text-sm text-foreground/80",
                        "transition-colors duration-100",
                        "aria-selected:bg-accent aria-selected:text-foreground",
                      ].join(" ")}
                    >
                      {Icon && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 transition-colors duration-100 group-aria-selected/item:border-border group-aria-selected/item:bg-accent-foreground/10">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground/70 group-aria-selected/item:text-foreground/80" />
                        </span>
                      )}
                      <span className="flex-1 truncate font-medium">{route.title}</span>

                      {/* "Jump to" hint — only visible when row is selected */}
                      <span className="hidden text-[11px] text-muted-foreground/50 group-aria-selected/item:inline">
                        Jump to →
                      </span>
                    </CommandItem>

                    {/* Algolia-style Nested Sub Links */}
                    {route.subLinks && route.subLinks.length > 0 && (
                      <div className="relative">
                        {/* Tree connector line */}
                        <div className="absolute left-[21px] top-0 bottom-4 w-px bg-border/40" />
                        
                        {route.subLinks.map((sub, index) => {
                          const isLast = index === route.subLinks!.length - 1;
                          return (
                            <CommandItem
                              key={sub.href}
                              // Combines parent and child title to make fuzzy search find children from parent terms
                              value={`${route.title} ${sub.title}`}
                              onSelect={() => {
                                runCommand(() => router.push(sub.href));
                              }}
                              className={[
                                "group/sub cursor-pointer rounded-md",
                                "gap-3 py-1.5 pr-3 pl-11", // Indentation
                                "text-[13px] text-muted-foreground/80",
                                "transition-colors duration-100",
                                "aria-selected:bg-accent aria-selected:text-foreground",
                              ].join(" ")}
                            >
                              {/* Horizontal branch line */}
                              <div className="absolute left-[21px] top-1/2 h-px w-3 -translate-y-1/2 bg-border/40" />
                              
                              <span className="flex-1 truncate">{sub.title}</span>
                              <span className="hidden text-[11px] text-muted-foreground/50 group-aria-selected/sub:inline">
                                Go to section ↵
                              </span>
                            </CommandItem>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}