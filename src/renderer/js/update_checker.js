const LOCAL_VERSION = 'V0.1.0-dev';
const CHECK_VERSION_URL = 'https://raw.githubusercontent.com/SimpERROR/SimpMC-Launcher/refs/heads/main/SimpMC_Assets/version.json';
const GITHUB_RELEASE_URL = 'https://github.com/SimpERROR/SimpMC-Launcher';

function isSnapshotOrDevVersion(version) {
    return /snapshot|dev|development|alpha|beta/i.test(version);
}

function normalizeVersion(version) {
    return String(version || '').trim().replace(/^v/i, '').toLowerCase();
}

function compareVersions(a, b) {
    const parse = (value) => String(value).split(/[\.-]/).map(part => parseInt(part.replace(/[^0-9]/g, ''), 10) || 0);
    const left = parse(normalizeVersion(a));
    const right = parse(normalizeVersion(b));
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const l = left[i] || 0;
        const r = right[i] || 0;
        if (l > r) return 1;
        if (l < r) return -1;
    }
    return 0;
}

function getUpdateReminderElements() {
    return {
        root: document.getElementById('update-reminder'),
        title: document.getElementById('update-reminder-title'),
        info: document.getElementById('update-reminder-content')
    };
}

function hideUpdateReminder() {
    const { root } = getUpdateReminderElements();
    if (!root) return;
    root.dataset.state = '';
    root.classList.remove('update-reminder-visible');
    root.classList.add('update-reminder-hidden');
}

function showUpdateReminder(state, title, message) {
    const { root, title: titleEl, info } = getUpdateReminderElements();
    if (!root || !titleEl || !info) return;

    root.dataset.state = state;
    root.classList.remove('update-reminder-hidden');
    root.classList.add('update-reminder-visible');
    root.classList.remove('update-reminder-error', 'update-reminder-snapshot');

    if (state === 'error') {
        root.classList.add('update-reminder-error');
    } else if (state === 'snapshot') {
        root.classList.add('update-reminder-snapshot');
    }

    titleEl.textContent = title;
    info.textContent = message;
}

async function get_latest_version() {
    console.log('[检查更新] 开始获取最新版本……');
    console.log('[检查更新] 从', CHECK_VERSION_URL, '。');
    const response = await fetch(CHECK_VERSION_URL);
    if (!response.ok) {
        throw new Error('网络错误：' + response.statusText);
    }
    const response_content = await response.json();
    console.log('[检查更新] 获得的内容：', response_content);
    if (typeof response_content === 'string') {
        return response_content;
    }
    return response_content.version || response_content.latest || response_content.tag_name || response_content;
}

async function checkUpdateStatus() {
    console.log('[检查更新] 开始检查更新：获取本地版本', LOCAL_VERSION);
    try {
        if (isSnapshotOrDevVersion(LOCAL_VERSION)) {
            showUpdateReminder(
                'snapshot',
                i18n('update.snapshot_title') || '您正在使用快照版/开发版。',
                i18n('update.snapshot_message') || '快照版/开发版可能包含不稳定的内容，且不会自动检查更新。'
            );
            return;
        }

        const latestVersion = await get_latest_version();
        if (!latestVersion) {
            throw new Error('未能解析服务器版本号');
        }

        const normalizedLocal = normalizeVersion(LOCAL_VERSION);
        const normalizedRemote = normalizeVersion(latestVersion);
        if (compareVersions(normalizedRemote, normalizedLocal) > 0) {
            showUpdateReminder(
                'update',
                i18n('update.title') || '新版本可用！',
                `${i18n('update.update_available') || '发现更新'}：${latestVersion}。点击前往下载。`
            );
            return;
        }

        hideUpdateReminder();
    } catch (error) {
        console.error('[检查更新] 检查版本失败：', error);
        showUpdateReminder(
            'error',
            i18n('update.title') || '更新检查失败',
            i18n('update.update_error') || '检查更新时出现错误。'
        );
    }
}

function initUpdateReminder() {
    const root = document.getElementById('update-reminder');
    if (!root) return;

    root.addEventListener('click', () => {
        const state = root.dataset.state;
        if (state === 'update') {
            openExternal(GITHUB_RELEASE_URL);
            return;
        }
        hideUpdateReminder();
    });

    hideUpdateReminder();
}
