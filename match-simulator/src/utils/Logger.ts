export class Logger {
  private static readonly LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  private static readonly currentLevel = Logger.LOG_LEVELS[process.env.LOG_LEVEL as keyof typeof Logger.LOG_LEVELS] || Logger.LOG_LEVELS.info;
  
  static error(message: string, meta?: any): void {
    if (this.currentLevel >= Logger.LOG_LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  }
  
  static warn(message: string, meta?: any): void {
    if (this.currentLevel >= Logger.LOG_LEVELS.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  }
  
  static info(message: string, meta?: any): void {
    if (this.currentLevel >= Logger.LOG_LEVELS.info) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  }
  
  static debug(message: string, meta?: any): void {
    if (this.currentLevel >= Logger.LOG_LEVELS.debug && process.env.ENABLE_DEBUG_LOGGING === 'true') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  }
  
  static performance(operation: string, duration: number, meta?: any): void {
    if (this.currentLevel >= Logger.LOG_LEVELS.info) {
      console.info(`[PERF] ${new Date().toISOString()} - ${operation} took ${duration.toFixed(2)}ms`, meta || '');
    }
  }
} 