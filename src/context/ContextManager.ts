import { AsyncLocalStorage } from 'async_hooks';

const storage = new AsyncLocalStorage<Record<string, unknown>>();

export const ContextManager = {
  runWithContext: <T>(context: Record<string, unknown>, callback: () => T): T => {
    const parent = storage.getStore() || {};
    const merged = { ...parent, ...context };
    return storage.run(merged, callback);
  },

  getContext: (): Record<string, unknown> => {
    return storage.getStore() || {};
  }
};
