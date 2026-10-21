import { LocaleData } from './types';

export const en: LocaleData = {
    common: {
        confirm: 'Confirm',
        cancel: 'Cancel',
        close: 'Close',
        loading: 'Loading...',
        error: 'Error',
        retry: 'Retry',
    },
    login: {
        title: 'Welcome to Pet World',
        usernamePlaceholder: 'Enter username',
        passwordPlaceholder: 'Enter password',
        submit: 'Login',
    },
    pet: {
        feed: 'Feed',
        play: 'Play',
        sleep: 'Sleep',
        hungryTip: '{name} is hungry, feed it now!',
        levelUp: '{name} reached level {level}!',
    },
    network: {
        connecting: 'Connecting to server...',
        reconnecting: 'Network disconnected, reconnecting (attempt {attempt})...',
        connectFailed: 'Failed to connect server, please check network',
    },
    download: {
        checkingUpdate: 'Checking for updates...',
        downloading: 'Downloading update {progress}%',
        updateReady: 'Update ready, restarting soon',
    },
};
