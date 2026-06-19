import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  isEditing: boolean;
  className?: string;
  isOverlay?: boolean;
}

export function SortableWidget({
  id,
  children,
  isEditing,
  className,
  isOverlay,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging || isOverlay ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-3xl",
        className,
        isEditing && "ring-2 ring-indigo-500/50"
      )}
    >
      {/* Drag Handle Overlay - Only visible when editing */}
      {isEditing && (
        <div 
          className="absolute inset-0 z-50 rounded-3xl bg-black/5 dark:bg-white/5 cursor-grab active:cursor-grabbing flex flex-col items-center justify-start pt-3"
          {...attributes}
          {...listeners}
        >
          <div className="bg-black/50 dark:bg-white/20 backdrop-blur-md rounded-full px-4 py-1 text-white shadow-lg pointer-events-none">
            <GripHorizontal size={20} />
          </div>
        </div>
      )}
      
      {/* When editing, disable pointer events on the content so we don't accidentally click links */}
      <div className={cn("h-full w-full", isEditing && "pointer-events-none")}>
        {children}
      </div>
    </div>
  );
}
