import { AsyncLocalStorage } from 'async_hooks';

// Singleton instance of AsyncLocalStorage
// We store a generic Record<string, unknown>
const storage = new AsyncLocalStorage<Record<string, unknown>>();

export const ContextManager = {
  /**
   * Run a function within a context.
   * All logs generated within the callback (even async ones) will inherit this context.
   */
  runWithContext: <T>(context: Record<string, unknown>, callback: () => T): T => {
    // If we are already in a context, merge it? 
    // For now, let's keep it simple: new context overrides.
    // Ideally, we should merge with parent context if it exists.
    const parent = storage.getStore() || {};
    const merged = { ...parent, ...context };
    return storage.run(merged, callback);
  },

  /**
   * Get the current active context.
   */
  getContext: (): Record<string, unknown> => {
    return storage.getStore() || {};
  }
};
