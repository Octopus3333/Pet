import { LocaleData } from './types';

export const zh: LocaleData = {
    common: {
        confirm: '确认',
        cancel: '取消',
        close: '关闭',
        loading: '加载中...',
        error: '出错了',
        retry: '重试',
    },
    login: {
        title: '欢迎来到养成世界',
        usernamePlaceholder: '请输入用户名',
        passwordPlaceholder: '请输入密码',
        submit: '登录',
    },
    pet: {
        feed: '喂食',
        play: '玩耍',
        sleep: '睡觉',
        hungryTip: '{name} 饿了，快给它喂食吧！',
        levelUp: '{name} 升到 {level} 级了！',
    },
    network: {
        connecting: '连接服务器...',
        reconnecting: '网络断开，正在重连（第 {attempt} 次）...',
        connectFailed: '连接服务器失败，请检查网络',
    },
    download: {
        checkingUpdate: '正在检查更新...',
        downloading: '正在下载更新 {progress}%',
        updateReady: '更新已准备好，即将重启',
    },
};
