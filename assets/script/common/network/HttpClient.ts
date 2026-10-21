import { GameConfig } from '../config/GameConfig';
import { RetryHelper, RetryOptions } from '../utils/RetryHelper';
import { TokenManager } from '../auth/TokenManager';

export interface HttpRequestOptions {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | FormData | Record<string, unknown>;
    timeout?: number;
    retry?: Partial<RetryOptions>;
}

export interface HttpResponse<T = unknown> {
    status: number;
    data: T;
    headers: Record<string, string>;
}

export class HttpClient {
    private static _instance: HttpClient;
    private _config = GameConfig.instance.network;

    private constructor() {}

    public static get instance(): HttpClient {
        if (!HttpClient._instance) {
            HttpClient._instance = new HttpClient();
        }
        return HttpClient._instance;
    }

    public async get<T = unknown>(
        path: string,
        options?: {
            headers?: Record<string, string>;
            timeout?: number;
            retry?: Partial<RetryOptions>;
        }
    ): Promise<HttpResponse<T>> {
        return this.request<T>({
            url: this.buildUrl(path),
            method: 'GET',
            headers: options?.headers,
            timeout: options?.timeout,
            retry: options?.retry,
        });
    }

    public async post<T = unknown>(
        path: string,
        body?: string | FormData | Record<string, unknown>,
        options?: {
            headers?: Record<string, string>;
            timeout?: number;
            retry?: Partial<RetryOptions>;
        }
    ): Promise<HttpResponse<T>> {
        return this.request<T>({
            url: this.buildUrl(path),
            method: 'POST',
            body,
            headers: options?.headers,
            timeout: options?.timeout,
            retry: options?.retry,
        });
    }

    public async put<T = unknown>(
        path: string,
        body?: string | FormData | Record<string, unknown>,
        options?: {
            headers?: Record<string, string>;
            timeout?: number;
            retry?: Partial<RetryOptions>;
        }
    ): Promise<HttpResponse<T>> {
        return this.request<T>({
            url: this.buildUrl(path),
            method: 'PUT',
            body,
            headers: options?.headers,
            timeout: options?.timeout,
            retry: options?.retry,
        });
    }

    public async delete<T = unknown>(
        path: string,
        options?: {
            headers?: Record<string, string>;
            timeout?: number;
            retry?: Partial<RetryOptions>;
        }
    ): Promise<HttpResponse<T>> {
        return this.request<T>({
            url: this.buildUrl(path),
            method: 'DELETE',
            headers: options?.headers,
            timeout: options?.timeout,
            retry: options?.retry,
        });
    }

    public async request<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
        const { url, method, headers, body, timeout = this._config.httpTimeout, retry } = options;

        const retryOptions: RetryOptions = {
            maxAttempts: retry?.maxAttempts ?? this._config.maxRetryAttempts,
            delayMs: retry?.delayMs ?? this._config.retryDelayMs,
            backoffFactor: retry?.backoffFactor ?? this._config.retryBackoffFactor,
            onRetry: retry?.onRetry,
        };

        return RetryHelper.execute(async () => {
            return this.performRequest<T>(url, method, headers, body, timeout);
        }, retryOptions);
    }

    private async performRequest<T>(
        url: string,
        method: string,
        headers?: Record<string, string>,
        body?: string | FormData | Record<string, unknown>,
        timeout: number = 10000
    ): Promise<HttpResponse<T>> {
        // AbortController 在原生 JSB 环境不存在，做兼容处理
        const hasAbortController = typeof AbortController !== 'undefined';
        let controller: AbortController | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        if (hasAbortController) {
            controller = new AbortController();
            timeoutId = setTimeout(() => controller!.abort(), timeout);
        }
        console.log("url=============",url)
        // 自动注入Token和设备ID到请求头
        const requestHeaders = new Headers(headers);
        const authHeaders = TokenManager.instance.getAuthHeaders();
        for (const [key, value] of Object.entries(authHeaders)) {
            if (!requestHeaders.has(key)) {
                requestHeaders.set(key, value);
            }
        }
        console.log("headers", requestHeaders)
        let requestBody: BodyInit | undefined;

        if (body !== undefined) {
            if (typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
                requestBody = JSON.stringify(body);
                requestHeaders.set('Content-Type', 'application/json');
            } else {
                requestBody = body as BodyInit;
            }
        }

        try {
            const response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: requestBody,
                signal: controller?.signal,
            });
            let data: T;
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = (await response.text()) as unknown as T;
            }

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(url + ":response",data)

            return {
                status: response.status,
                data,
                headers: responseHeaders,
            };
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    private buildUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const baseUrl = this._config.httpBaseUrl.replace(/\/$/, '');
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${normalizedPath}`;
    }
}