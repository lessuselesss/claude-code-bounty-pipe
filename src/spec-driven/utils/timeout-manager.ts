#!/usr/bin/env -S deno run --allow-all

/**
 * Timeout Management System
 *
 * Provides timeout handling and graceful degradation for spec-driven pipeline phases
 */

export interface TimeoutConfig {
  maxTurns: number;
  timeoutMs: number;
  gracefulDegradation: boolean;
  fallbackMode: 'basic' | 'skip' | 'cached';
}

export interface TimeoutResult<T> {
  success: boolean;
  result?: T;
  timedOut: boolean;
  degraded: boolean;
  fallbackUsed: boolean;
  executionTime: number;
}

export class TimeoutManager {

  /**
   * Execute function with timeout and graceful degradation
   */
  static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig,
    fallback?: () => Promise<T>
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now();

    try {
      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise(config.timeoutMs)
      ]);

      const executionTime = Date.now() - startTime;

      if (result === 'TIMEOUT') {
        console.log(`⏱️ Operation timed out after ${config.timeoutMs}ms`);

        if (config.gracefulDegradation && fallback) {
          console.log(`🔄 Attempting fallback operation...`);
          try {
            const fallbackResult = await fallback();
            return {
              success: true,
              result: fallbackResult,
              timedOut: true,
              degraded: true,
              fallbackUsed: true,
              executionTime: Date.now() - startTime
            };
          } catch (fallbackError) {
            console.log(`❌ Fallback also failed: ${fallbackError}`);
            return {
              success: false,
              timedOut: true,
              degraded: true,
              fallbackUsed: false,
              executionTime: Date.now() - startTime
            };
          }
        }

        return {
          success: false,
          timedOut: true,
          degraded: false,
          fallbackUsed: false,
          executionTime
        };
      }

      return {
        success: true,
        result,
        timedOut: false,
        degraded: false,
        fallbackUsed: false,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.log(`❌ Operation failed: ${error instanceof Error ? error.message : String(error)}`);

      if (config.gracefulDegradation && fallback) {
        console.log(`🔄 Attempting fallback due to error...`);
        try {
          const fallbackResult = await fallback();
          return {
            success: true,
            result: fallbackResult,
            timedOut: false,
            degraded: true,
            fallbackUsed: true,
            executionTime: Date.now() - startTime
          };
        } catch (fallbackError) {
          console.log(`❌ Fallback also failed: ${fallbackError}`);
        }
      }

      return {
        success: false,
        timedOut: false,
        degraded: false,
        fallbackUsed: false,
        executionTime
      };
    }
  }

  /**
   * Create timeout promise that resolves with 'TIMEOUT' after specified milliseconds
   */
  private static createTimeoutPromise(timeoutMs: number): Promise<'TIMEOUT'> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('TIMEOUT'), timeoutMs);
    });
  }

  /**
   * Get optimized config based on phase type
   */
  static getPhaseConfig(phase: 'spec-analysis' | 'environment-setup' | 'implementation' | 'validation'): TimeoutConfig {
    const configs: Record<string, TimeoutConfig> = {
      'spec-analysis': {
        maxTurns: 3,
        timeoutMs: 45000, // 45 seconds
        gracefulDegradation: true,
        fallbackMode: 'basic'
      },
      'environment-setup': {
        maxTurns: 8,
        timeoutMs: 90000, // 90 seconds
        gracefulDegradation: true,
        fallbackMode: 'cached'
      },
      'implementation': {
        maxTurns: 6,
        timeoutMs: 60000, // 60 seconds
        gracefulDegradation: true,
        fallbackMode: 'basic'
      },
      'validation': {
        maxTurns: 5,
        timeoutMs: 45000, // 45 seconds
        gracefulDegradation: true,
        fallbackMode: 'basic'
      }
    };

    return configs[phase] || configs['environment-setup'];
  }
}