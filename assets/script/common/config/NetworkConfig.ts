import {
    SOCKET_HOST,
    SOCKET_PORT,
    HTTP_BASE_URL,
    NETWORK_RETRY_MAX_ATTEMPTS,
    NETWORK_RETRY_DELAY_MS,
    NETWORK_RETRY_BACKOFF_FACTOR,
    HTTP_REQUEST_TIMEOUT,
    SOCKET_CONNECT_TIMEOUT,
    SOCKET_PING_INTERVAL,
} from '../consts/NetworkConsts';

export class NetworkConfig {
    private static _instance: NetworkConfig;

    private constructor() {}

    public static get instance(): NetworkConfig {
        if (!NetworkConfig._instance) {
            NetworkConfig._instance = new NetworkConfig();
        }
        return NetworkConfig._instance;
    }

    public get socketHost(): string {
        return SOCKET_HOST;
    }

    public get socketPort(): number {
        return SOCKET_PORT;
    }

    public get httpBaseUrl(): string {
        return HTTP_BASE_URL;
    }

    public get maxRetryAttempts(): number {
        return NETWORK_RETRY_MAX_ATTEMPTS;
    }

    public get retryDelayMs(): number {
        return NETWORK_RETRY_DELAY_MS;
    }

    public get retryBackoffFactor(): number {
        return NETWORK_RETRY_BACKOFF_FACTOR;
    }

    public get httpTimeout(): number {
        return HTTP_REQUEST_TIMEOUT;
    }

    public get socketConnectTimeout(): number {
        return SOCKET_CONNECT_TIMEOUT;
    }

    public get socketPingInterval(): number {
        return SOCKET_PING_INTERVAL;
    }
}
