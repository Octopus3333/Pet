export interface RetryOptions {
    maxAttempts: number;
    delayMs: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: unknown) => void;
}

export class RetryHelper {
    public static async execute<T>(
        fn: () => Promise<T>,
        options: RetryOptions
    ): Promise<T> {
        const { maxAttempts, delayMs, backoffFactor = 1, onRetry } = options;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    onRetry?.(attempt, error);
                    const currentDelay = delayMs * Math.pow(backoffFactor, attempt - 1);
                    await this.delay(currentDelay);
                }
            }
        }

        throw lastError;
    }

    public static async executeWithCondition<T>(
        fn: () => Promise<T>,
        options: RetryOptions,
        shouldRetry: (error: unknown) => boolean
    ): Promise<T> {
        const { maxAttempts, delayMs, backoffFactor = 1, onRetry } = options;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts && shouldRetry(error)) {
                    onRetry?.(attempt, error);
                    const currentDelay = delayMs * Math.pow(backoffFactor, attempt - 1);
                    await this.delay(currentDelay);
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    private static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}