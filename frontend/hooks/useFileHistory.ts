import { useState } from "react";

/** Client-side undo/redo: a stack of visited file_ids plus a pointer. Every
 * commit (Clean/Format/Formula/Chart, or the formula bar) writes to a new
 * file_id and never overwrites the old one, so undo/redo just means re-loading
 * a previous file_id -- no backend support needed. */
export function useFileHistory() {
  const [stack, setStack] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);

  const canUndo = index > 0;
  const canRedo = index >= 0 && index < stack.length - 1;

  const reset = (fileId: string) => {
    setStack([fileId]);
    setIndex(0);
  };

  const record = (fileId: string) => {
    const truncated = stack.slice(0, index + 1);
    setStack([...truncated, fileId]);
    setIndex(truncated.length);
  };

  const undo = (): string | null => {
    if (!canUndo) return null;
    const nextIndex = index - 1;
    setIndex(nextIndex);
    return stack[nextIndex];
  };

  const redo = (): string | null => {
    if (!canRedo) return null;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    return stack[nextIndex];
  };

  return { canUndo, canRedo, reset, record, undo, redo };
}
