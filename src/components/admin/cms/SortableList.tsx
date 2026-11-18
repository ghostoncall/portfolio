/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic sortable list: drag-and-drop via @dnd-kit plus keyboard-accessible
// Move up/Move down buttons.

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableControls = {
  index: number;
  isDragging: boolean;
  moveUp: () => void;
  moveDown: () => void;
  dragHandleProps: ReturnType<typeof useSortable>["attributes"] & {
    ref: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  };
};

const pointerThenCenter: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
};

function SortableItem<T>({
  item,
  index,
  getId,
  moveUp,
  moveDown,
  handleOnly,
  renderItem,
}: {
  item: T;
  index: number;
  getId: (item: any, index: number) => string;
  moveUp: () => void;
  moveDown: () => void;
  handleOnly: boolean;
  renderItem: (item: T, controls: SortableControls) => React.ReactNode;
}) {
  const id = getId(item, index);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    strategy: verticalListSortingStrategy,
  });
  return (
    <div
      key={id}
      ref={setNodeRef}
      {...(!handleOnly ? { ...attributes, ...listeners } : {})}
      style={
        handleOnly
          ? {
              transform: CSS.Transform.toString(transform),
              transition,
              position: "relative",
              zIndex: isDragging ? 1 : undefined,
            }
          : undefined
      }
      data-testid="sortable-item"
    >
      {renderItem(item, {
        index,
        isDragging: handleOnly && isDragging,
        moveUp,
        moveDown,
        dragHandleProps: { ...attributes, ...listeners, ref: setActivatorNodeRef },
      })}
    </div>
  );
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  handleOnly = false,
}: {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, controls: SortableControls) => React.ReactNode;
  /** Opt-in: drag only from the supplied handle, leaving text/media controls untouched. */
  handleOnly?: boolean;
}) {
  const sensors = useSensors(
    // Without a distance constraint a plain click on a row's buttons (Edit,
    // Hide, Del.) is swallowed as a zero-distance drag and never fires onClick.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, handleOnly ? { coordinateGetter: sortableKeyboardCoordinates } : {}),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = items.findIndex((i) => getId(i, items.indexOf(i)) === activeId);
    const newIndex = items.findIndex((i) => getId(i, items.indexOf(i)) === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  const moveItem = (id: string, delta: number) => {
    const index = items.findIndex((i) => getId(i, items.indexOf(i)) === id);
    if (index < 0) return;
    const next = arrayMove(items, index, index + delta);
    onReorder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      {...(handleOnly ? { collisionDetection: pointerThenCenter } : {})}
    >
      <SortableContext
        items={items.map((i, ix) => String(getId(i, ix)))}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, index) => {
          const id = getId(item, index);
          return (
            <SortableItem
              key={id}
              item={item}
              index={index}
              getId={getId}
              moveUp={() => moveItem(id, -1)}
              moveDown={() => moveItem(id, 1)}
              handleOnly={handleOnly}
              renderItem={renderItem}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
