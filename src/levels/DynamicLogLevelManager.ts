import { LogLevel } from '../types.js';

export interface LevelOverride {
  level: LogLevel;
  userId?: string;
  feature?: string;
  path?: string;
  expiresAt?: number;
}

export class DynamicLogLevelManager {
  private defaultLevel: LogLevel;
  private overrides: Map<string, LevelOverride>;
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
  };

  constructor(defaultLevel: LogLevel = LogLevel.INFO) {
    this.defaultLevel = defaultLevel;
    this.overrides = new Map();
  }

  setLevel(level: LogLevel, options: { userId?: string; feature?: string; path?: string; duration?: string } = {}): string | void {
    if (!options.userId && !options.feature && !options.path) {
      this.defaultLevel = level;
      return;
    }

    const ruleId = this.generateRuleId(options);
    const override: LevelOverride = {
      level,
      userId: options.userId,
      feature: options.feature,
      path: options.path,
      expiresAt: options.duration ? this.parseExpiry(options.duration) : undefined
    };

    this.overrides.set(ruleId, override);

    if (override.expiresAt) {
      setTimeout(() => {
        this.overrides.delete(ruleId);
      }, override.expiresAt - Date.now());
    }

    return ruleId;
  }

  shouldLog(level: LogLevel, context: Record<string, unknown> = {}): boolean {
    const logLevelValue = DynamicLogLevelManager.LEVEL_PRIORITY[level];
    
    for (const override of this.overrides.values()) {
      if (this.matchesOverride(override, context)) {
        const overrideLevelValue = DynamicLogLevelManager.LEVEL_PRIORITY[override.level];
        return logLevelValue >= overrideLevelValue;
      }
    }

    const defaultLevelValue = DynamicLogLevelManager.LEVEL_PRIORITY[this.defaultLevel];
    return logLevelValue >= defaultLevelValue;
  }

  private matchesOverride(override: LevelOverride, context: Record<string, unknown>): boolean {
    if (override.expiresAt && Date.now() > override.expiresAt) {
      return false;
    }

    if (override.userId && context.userId === override.userId) {
      return true;
    }

    if (override.feature && context.feature === override.feature) {
      return true;
    }

    if (override.path && typeof context.path === 'string' && context.path.startsWith(override.path)) {
      return true;
    }

    return false;
  }

  private parseExpiry(duration: string): number {
    const regex = /^(\d+)(s|m|h|d)$/;
    const match = duration.match(regex);
    if (!match) throw new Error('Invalid duration format');

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return Date.now() + (value * multipliers[unit]);
  }

  private generateRuleId(options: { userId?: string; feature?: string; path?: string }): string {
    return `${options.userId || ''}-${options.feature || ''}-${options.path || ''}-${Date.now()}`;
  }

  listOverrides(): (LevelOverride & { id: string; remaining: number | null })[] {
    return Array.from(this.overrides.entries()).map(([id, override]) => ({
      id,
      ...override,
      remaining: override.expiresAt ? override.expiresAt - Date.now() : null
    }));
  }

  removeOverride(ruleId: string): boolean {
    return this.overrides.delete(ruleId);
  }
}
