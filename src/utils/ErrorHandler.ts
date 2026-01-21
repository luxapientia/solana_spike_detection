/**
 * Error Handler and Retry Logic
 * Provides retry mechanism with exponential backoff and error handling
 */

export class ErrorHandler {
  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
    onError?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (onError) {
          onError(error, attempt);
        }

        if (attempt < maxRetries) {
          // Exponential backoff: delay = initialDelay * 2^(attempt-1)
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Check if error is a rate limit error
   */
  static isRateLimitError(error: any): boolean {
    if (!error || !error.response) return false;
    
    const status = error.response.status || error.response.statusCode;
    return status === 429 || status === 503;
  }

  /**
   * Check if error is a network error
   */
  static isNetworkError(error: any): boolean {
    if (!error) return false;
    
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('network') ||
      error.message?.includes('timeout')
    );
  }

  /**
   * Handle API errors gracefully
   */
  static handleApiError(error: any, context: string): void {
    if (this.isRateLimitError(error)) {
      console.warn(`[${context}] Rate limit hit. Waiting before retry...`);
    } else if (this.isNetworkError(error)) {
      console.warn(`[${context}] Network error:`, error.message);
    } else {
      console.error(`[${context}] API error:`, error.message);
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
