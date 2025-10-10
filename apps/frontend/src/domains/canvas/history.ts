import { createSignal } from 'solid-js';

type CreateHistoryOptions<T> = {
  snapshotSource: () => T;
  applySnapshot: (snapshot: T) => void;
  cloneSnapshot: (snapshot: T) => T;
  cap?: number;
};

export type HistoryController<T> = {
  history: () => T[];
  historyIndex: () => number;
  hasChanges: () => boolean;
  setHasChanges: (value: boolean) => void;
  pushHistory: (snapshot?: T) => void;
  replaceHistory: (snapshot: T) => void;
  undo: () => void;
  redo: () => void;
  resetHistory: () => void;
};

const DEFAULT_CAP = 50;

export const createHistory = <T>({
  snapshotSource,
  applySnapshot,
  cloneSnapshot,
  cap = DEFAULT_CAP,
}: CreateHistoryOptions<T>): HistoryController<T> => {
  const [history, setHistory] = createSignal<T[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [hasChanges, setHasChanges] = createSignal(false);

  const replaceHistory = (snapshot: T) => {
    const clone = cloneSnapshot(snapshot);
    setHistory([clone]);
    setHistoryIndex(0);
    setHasChanges(false);
  };

  const pushHistory = (snapshot?: T) => {
    const source = snapshot ?? snapshotSource();
    const clone = cloneSnapshot(source);

    setHistory((current) => {
      const currentIndex = historyIndex();
      const trimmed = current.slice(0, currentIndex + 1);
      const updated = [...trimmed, clone];
      const limited = updated.length > cap ? updated.slice(updated.length - cap) : updated;
      setHistoryIndex(limited.length - 1);
      return limited;
    });

    setHasChanges(true);
  };

  const undo = () => {
    const current = history();
    const index = historyIndex();
    if (index <= 0 || current.length === 0) return;
    const newIndex = index - 1;
    setHistoryIndex(newIndex);
    applySnapshot(cloneSnapshot(current[newIndex]));
  };

  const redo = () => {
    const current = history();
    const index = historyIndex();
    if (index === -1 || index >= current.length - 1) return;
    const newIndex = index + 1;
    setHistoryIndex(newIndex);
    applySnapshot(cloneSnapshot(current[newIndex]));
  };

  const resetHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
    setHasChanges(false);
  };

  return {
    history,
    historyIndex,
    hasChanges,
    setHasChanges,
    pushHistory,
    replaceHistory,
    undo,
    redo,
    resetHistory,
  };
};

