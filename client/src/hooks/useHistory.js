import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 50;

/**
 * useHistory — undo/redo stack for tree editing actions.
 *
 * Each snapshot is a plain serialisable object:
 *   { people: [...], relationships: [...], nodePositions: { [personId]: {x,y} } }
 *
 * Usage:
 *   const { pushHistory, resetHistory, undo, redo, canUndo, canRedo } = useHistory();
 *
 *   - pushHistory(snapshot)  — call after every CRUD action
 *   - resetHistory(snapshot) — call after initial tree load to clear the stack
 *   - undo() / redo()        — return the snapshot to restore, or null if not possible
 *   - canUndo / canRedo      — boolean flags for disabling UI buttons
 */
export function useHistory() {
  const stack = useRef([]);
  const idx   = useRef(-1);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const resetHistory = useCallback((initialSnapshot) => {
    stack.current = [initialSnapshot];
    idx.current   = 0;
    bump();
  }, []);

  const pushHistory = useCallback((snapshot) => {
    // Discard any future states (can't redo after a new action)
    stack.current = stack.current.slice(0, idx.current + 1);
    stack.current.push(snapshot);
    if (stack.current.length > MAX_HISTORY) stack.current.shift();
    idx.current = stack.current.length - 1;
    bump();
  }, []);

  const undo = useCallback(() => {
    if (idx.current <= 0) return null;
    idx.current -= 1;
    bump();
    return stack.current[idx.current];
  }, []);

  const redo = useCallback(() => {
    if (idx.current >= stack.current.length - 1) return null;
    idx.current += 1;
    bump();
    return stack.current[idx.current];
  }, []);

  return {
    pushHistory,
    resetHistory,
    undo,
    redo,
    canUndo: idx.current > 0,
    canRedo: idx.current < stack.current.length - 1,
  };
}
