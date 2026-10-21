import { LocaleData, LocaleValue } from './types';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from '../consts/LocaleConsts';
import { zh } from './zh';
import { en } from './en';

export class LocaleManager {
    private static _instance: LocaleManager;
    private _locales: Map<string, LocaleData> = new Map();
    private _currentLanguage: string = DEFAULT_LANGUAGE;
    private _fallbackLanguage: string = FALLBACK_LANGUAGE;

    private constructor() {
        this.register('zh', zh);
        this.register('en', en);
    }

    public static get instance(): LocaleManager {
        if (!LocaleManager._instance) {
            LocaleManager._instance = new LocaleManager();
        }
        return LocaleManager._instance;
    }

    public get currentLanguage(): string {
        return this._currentLanguage;
    }

    public register(language: string, data: LocaleData): void {
        this._locales.set(language, data);
    }

    public unregister(language: string): void {
        this._locales.delete(language);
    }

    public setLanguage(language: string): boolean {
        if (!this._locales.has(language)) {
            console.warn(`Locale ${language} not registered`);
            return false;
        }
        this._currentLanguage = language;
        return true;
    }

    public t(key: string, params?: Record<string, string | number>): string {
        let value = this.getValue(key);

        if (value === undefined) {
            console.warn(`Missing locale key: ${key}`);
            return key;
        }

        if (typeof value !== 'string') {
            console.warn(`Locale key is not a string: ${key}`);
            return key;
        }

        if (params) {
            value = this.interpolate(value, params);
        }

        return value;
    }

    public has(key: string): boolean {
        return this.getValue(key) !== undefined;
    }

    private getValue(key: string): LocaleValue | undefined {
        const languages = [this._currentLanguage, this._fallbackLanguage];

        for (const language of languages) {
            const data = this._locales.get(language);
            if (!data) continue;

            const value = this.resolveKey(data, key);
            if (value !== undefined) {
                return value;
            }
        }

        return undefined;
    }

    private resolveKey(data: LocaleData, key: string): LocaleValue | undefined {
        const keys = key.split('.');
        let current: LocaleValue = data;

        for (const k of keys) {
            if (current === null || typeof current !== 'object') {
                return undefined;
            }
            current = (current as Record<string, LocaleValue>)[k];
            if (current === undefined) {
                return undefined;
            }
        }

        return current;
    }

    private interpolate(template: string, params: Record<string, string | number>): string {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = params[key];
            return value !== undefined ? String(value) : match;
        });
    }
}
