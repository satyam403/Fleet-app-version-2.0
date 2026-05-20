"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle as ResizeHandle,
} from "react-resizable-panels";
import { cn } from "./utils";

export function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof PanelGroup>) {
  return (
    <PanelGroup
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  );
}

export function ResizablePanel(
  props: React.ComponentProps<typeof Panel>
) {
  return <Panel {...props} />;
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizeHandle
      className={cn(
        "bg-border relative flex w-px items-center justify-center",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="flex h-4 w-3 items-center justify-center rounded border">
          <GripVertical className="h-3 w-3" />
        </div>
      )}
    </ResizeHandle>
  );
}