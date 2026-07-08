/**
 * Error Monitoring and Logging Setup
 * 
 * This file provides utilities for error tracking and logging.
 * For production, integrate with Sentry, Rollbar, or similar service.
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  CRITICAL = "critical",
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: any;
}

export interface ErrorLog {
  level: LogLevel;
  message: string;
  error?: Error;
  context?: LogContext;
  timestamp: Date;
  stack?: string;
}

class Logger {
  private logs: ErrorLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  /**
   * Log a message with context
   */
  log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const log: ErrorLog = {
      level,
      message,
      context,
      error,
      timestamp: new Date(),
      stack: error?.stack,
    };

    // Add to in-memory store
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output (development)
    if (process.env.NODE_ENV === "development") {
      this.consoleLog(log);
    }

    // Send to external service (production)
    if (process.env.NODE_ENV === "production") {
      this.sendToExternalService(log);
    }

    // Save critical errors to database
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) {
      this.saveToDB(log);
    }
  }

  private consoleLog(log: ErrorLog) {
    const prefix = `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}]`;
    const contextStr = log.context ? JSON.stringify(log.context) : "";

    switch (log.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, log.message, contextStr);
        break;
      case LogLevel.INFO:
        console.info(prefix, log.message, contextStr);
        break;
      case LogLevel.WARN:
        console.warn(prefix, log.message, contextStr);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, log.message, contextStr, log.error);
        if (log.stack) console.error(log.stack);
        break;
    }
  }

  private async sendToExternalService(log: ErrorLog) {
    // TODO: Integrate with Sentry
    // Example:
    // import * as Sentry from "@sentry/nextjs";
    // if (log.error) {
    //   Sentry.captureException(log.error, {
    //     level: log.level as any,
    //     contexts: { custom: log.context },
    //   });
    // } else {
    //   Sentry.captureMessage(log.message, {
    //     level: log.level as any,
    //     contexts: { custom: log.context },
    //   });
    // }
  }

  private async saveToDB(log: ErrorLog) {
    try {
      // Save to database for audit trail
      const { db } = await import("@/prisma/db");
      await db.auditLog.create({
        data: {
          action: log.level.toUpperCase(),
          details: {
            message: log.message,
            context: log.context,
            stack: log.stack,
          },
          userId: log.context?.userId || undefined,
          entityType: "Log",
          ipAddress: log.context?.ip || undefined,
          userAgent: log.context?.userAgent || undefined,
        },
      });
    } catch (error) {
      // Don't throw if logging fails
      console.error("Failed to save log to database:", error);
    }
  }

  /**
   * Convenience methods
   */
  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * Get recent logs (for admin dashboard)
   */
  getRecentLogs(count: number = 100): ErrorLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = [];
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Error boundary helper for API routes
 */
export async function withErrorHandling<T>(
  handler: () => Promise<T>,
  context?: LogContext
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await handler();
    return { success: true, data };
  } catch (error: any) {
    logger.error("API Error", error, context);
    return {
      success: false,
      error: process.env.NODE_ENV === "production"
        ? "An error occurred"
        : error.message,
    };
  }
}

/**
 * Track financial transaction for audit
 */
export async function auditFinancialTransaction(data: {
  action: string;
  userId: string;
  amount?: number;
  accountId?: string;
  transactionRef?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const { db } = await import("@/prisma/db");
    await db.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId || undefined,
        entityType: "Financial",
        details: {
          amount: data.amount,
          accountId: data.accountId,
          transactionRef: data.transactionRef,
          ...data.details,
        },
        ipAddress: data.ip || undefined,
        userAgent: data.userAgent || undefined,
      },
    });

    logger.info(`Financial transaction: ${data.action}`, {
      userId: data.userId,
      amount: data.amount,
      transactionRef: data.transactionRef,
    });
  } catch (error) {
    logger.error("Failed to create audit log", error as Error);
  }
}
