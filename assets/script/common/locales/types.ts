export type LocaleValue = string | LocaleObject;

export interface LocaleObject {
    [key: string]: LocaleValue;
}

export type LocaleData = Record<string, LocaleValue>;
