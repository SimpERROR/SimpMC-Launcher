const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const Store = require('electron-store');
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

let store = null;

function initStore() {
    try {
        const userDataPath = app.getPath('userData');
        console.log('Store will use path:', userDataPath);
        
        store = new Store({
            name: 'config',
            defaults: {
                onboardingCompleted: false,
                appLocale: 'zh-CN',
                character: null,
                displayName: null,
                musicEnabled: true,
                musicVolume: 0.5
            }
        });
        console.log('Store initialized successfully');
    } catch (error) {
        console.error('Failed to initialize store:', error);
    }
}

let characterWindow = null;
let currentCharacterType = null;
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        title: "SimpMC Minecraft Launcher",
        frame: false,
        transparent: true,
        resizable: false,
        icon: path.join(__dirname, '../assets/logo.ico'),
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    initStore();
    createWindow();
    
    // 应用启动时扫描音乐目录，如果没有则自动创建
    scanMusicDirectory();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 添加 IPC 处理，让渲染进程请求播放音乐
ipcMain.handle('request_play_music', () => {
    if (store && store.get('musicEnabled', true)) {
        playNextTrack();
        return true;
    }
    return false;
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get_user_locale', () => {
    return app.getLocale();
});

ipcMain.handle('get_app_locale', () => {
    if (!store) return 'zh-CN';
    return store.get('appLocale', 'zh-CN');
});

ipcMain.handle('set_app_locale', (event, locale) => {
    if (!store) return false;
    store.set('appLocale', locale);
    return true;
});

ipcMain.handle('get_system_username', () => {
    return os.userInfo().username;
});

ipcMain.handle('get_display_name', () => {
    if (!store) return null;
    return store.get('displayName', null);
});

ipcMain.handle('set_display_name', (event, name) => {
    if (!store) return false;
    store.set('displayName', name);
    return true;
});

ipcMain.handle('check_first_run', () => {
    if (!store) return true;
    return !store.get('onboardingCompleted', false);
});

ipcMain.handle('select_directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('finish_onboarding', (event, data) => {
    if (!store) return false;
    store.set('onboardingCompleted', true);
    if (data.appLocale) {
        store.set('appLocale', data.appLocale);
    }
    if (data.character) {
        store.set('character', data.character);
    }
    return true;
});

ipcMain.handle('open_profile_window', () => {
    if (characterWindow) {
        characterWindow.focus();
        return;
    }
    
    characterWindow = new BrowserWindow({
        width: 500,
        height: 450,
        title: "管理档案",
        frame: false,
        transparent: true,
        resizable: false,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    
    characterWindow.loadFile(path.join(__dirname, '../renderer/character.html'));
    
    characterWindow.on('closed', () => {
        characterWindow = null;
    });
});

ipcMain.handle('reset_onboarding', () => {
    if (!store) return false;
    store.set('onboardingCompleted', false);
    return true;
});

ipcMain.handle('get_profiles', () => {
    if (!store) return { profiles: [], currentCharacter: null };
    const profiles = [...store.get('profiles', [])];
    const currentCharacter = store.get('character', null);
    
    if (currentCharacter && !profiles.find(p => p.id === currentCharacter.id)) {
        profiles.unshift(currentCharacter);
    }
    
    return {
        profiles: profiles,
        currentCharacter: currentCharacter
    };
});

ipcMain.handle('update_profile', (event, profileData) => {
    if (!store) return false;
    const profiles = store.get('profiles', []);
    const index = profiles.findIndex(p => p.id === profileData.id);
    if (index !== -1) {
        profiles[index] = { ...profiles[index], ...profileData };
        store.set('profiles', profiles);
        
        const currentCharacter = store.get('character', null);
        if (currentCharacter && currentCharacter.id === profileData.id) {
            store.set('character', profiles[index]);
        }
        return true;
    }
    return false;
});

ipcMain.handle('delete_profile', (event, profileId) => {
    if (!store) return false;
    const profiles = store.get('profiles', []);
    const filtered = profiles.filter(p => p.id !== profileId);
    store.set('profiles', filtered);
    
    const currentCharacter = store.get('character', null);
    if (currentCharacter && currentCharacter.id === profileId) {
        store.delete('character');
    }
    return true;
});

ipcMain.handle('get_wardrobe', () => {
    if (!store) return { skins: [], capes: [] };
    return {
        skins: store.get('wardrobe.skins', []),
        capes: store.get('wardrobe.capes', [])
    };
});

ipcMain.handle('add_wardrobe_item', (event, item) => {
    if (!store) return false;
    const type = item.type;
    const key = `wardrobe.${type}s`;
    const items = store.get(key, []);
    
    const defaultItems = type === 'skin' ? [
        { id: 'steve', name: 'Steve', type: 'skin', isDefault: true },
        { id: 'alex', name: 'Alex', type: 'skin', isDefault: true }
    ] : [];
    
    if (items.length === 0 && type === 'skin') {   store.set(key, defaultItems);
    }
    
    if (item.isDefault) {
        return true;
    }
    
    const newItem = {
        ...item,
        id: `custom_${Date.now()}`
    };
    
    items.push(newItem);
    store.set(key, items);
    return true;
});

ipcMain.handle('delete_wardrobe_item', (event, itemId, type) => {
    if (!store) return false;
    const key = `wardrobe.${type}s`;
    const items = store.get(key, []);
    const item = items.find(i => i.id === itemId);
    if (item && item.isDefault) return false;
    
    const filtered = items.filter(i => i.id !== itemId);
    store.set(key, filtered);
    return true;
});

ipcMain.handle('update_wardrobe_item', (event, item) => {
    if (!store) return false;
    const type = item.type;
    const key = `wardrobe.${type}s`;
    const items = store.get(key, []);
    const index = items.findIndex(i => i.id === item.id);
    if (index !== -1) {
        items[index] = { ...items[index], ...item };
        store.set(key, items);
        return true;
    }
    return false;
});

ipcMain.handle('select_skin_file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PNG Images', extensions: ['png'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('select_cape_file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PNG Images', extensions: ['png'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('open_character_window', (event, characterType, editProfile) => {
    if (characterWindow) {
        characterWindow.focus();
        return;
    }

    currentCharacterType = characterType;

    characterWindow = new BrowserWindow({
        width: 500,
        height: 580,
        title: editProfile ? "编辑角色" : "创建角色",
        frame: false,
        parent: BrowserWindow.fromWebContents(event.sender),
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    characterWindow.loadFile(path.join(__dirname, '../renderer/character.html'));

    characterWindow.webContents.on('did-finish-load', () => {
        characterWindow.webContents.send('character_type', characterType);
        if (editProfile) {
            characterWindow.webContents.send('edit_profile', editProfile);
        }
    });

    characterWindow.on('closed', () => {
        event.sender.send('character_window_closed');
        characterWindow = null;
        currentCharacterType = null;
    });
});

ipcMain.on('close_character_window', () => {
    if (characterWindow) {
        characterWindow.close();
    }
});

ipcMain.on('create_character', (event, data) => {
    console.log('收到创建角色请求:', data);
    console.log('当前角色类型:', currentCharacterType);
    if (characterWindow) {
        characterWindow.close();
    }
    
    const characterData = {
        ...data,
        type: currentCharacterType
    };
    
    if (store) {
        const profiles = store.get('profiles', []);
        if (!profiles.find(p => p.id === characterData.id)) {
            profiles.push(characterData);
            store.set('profiles', profiles);
        }
        store.set('character', characterData);
    }
    
    console.log('发送 character_created 事件到主窗口');
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('character_created', characterData);
    }
});

ipcMain.handle('microsoft_auth', async () => {
    try {
        const { Auth } = require('msmc');
        
        const auth = new Auth({
            client_id: "a23d8dc0-0764-4667-bd87-5268121cbb4f",
            redirect: "http://localhost:8080", 
            
            authority: "common"
        });
        
        // 尝试添加 prompt 参数，强制弹出选择账号界面，这有助于刷新登录状态
        // 并且确保使用 'electron' 模式
        const xbox = await auth.launch('electron', {
            extraParameters: {
                scope: "XboxLive.signin offline_access User.Read",
                prompt: "select_account" 
            }
        });

        const mc = await xbox.getMinecraft();

        if (!mc || !mc.profile) {
            throw new Error("Login cancelled or failed");
        }

        // 建议在这里打印一下 mc 对象，看看结构
        console.log("MC Object:", mc);

        return {
            success: true,
            user: {
                id: mc.profile.id,
                name: mc.profile.name
            },
            profiles: [{
                id: mc.profile.id,
                name: mc.profile.name,
                // 关键点：某些版本的 msmc 使用 mc.access_token，
                // 某些版本在 mc.getToken() 里
                accessToken: mc.access_token || (mc.token ? mc.token.token : null) 
            }]
        };
    } catch (error) {
        console.error('Microsoft auth error:', error);
        return {
            success: false,
            error: error.message || "Authentication failed"
        };
    }
});

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    if (action === 'close') win.close();
    if (action === 'minimize') win.minimize();
});

let downloadManager = {
    currentDownload: null,
    isPaused: false,
    isCancelled: false
};

const DOWNLOAD_SOURCES = {
    official: {
        name: 'official',
        baseUrl: 'https://launchermeta.mojang.com',
        resourceBaseUrl: 'https://piston-data.mojang.com'
    },
    bmclapi: {
        name: 'bmclapi',
        baseUrl: 'https://bmclapi2.bangbang93.com',
        resourceBaseUrl: 'https://bmclapi2.bangbang93.com'
    }
};

function getDefaultInstallPath() {
    return path.join(app.getPath('userData'), 'minecraft');
}

function getCurrentDownloadSource() {
    if (!store) return DOWNLOAD_SOURCES.official;
    const sourceName = store.get('downloadSource', 'official');
    return DOWNLOAD_SOURCES[sourceName] || DOWNLOAD_SOURCES.official;
}

function transformUrlForSource(url, source) {
    if (source.name === 'official') return url;
    
    // 转换官方URL为BMCLAPI URL
    let transformedUrl = url;
    
    // 版本清单
    if (url.includes('launchermeta.mojang.com')) {
        transformedUrl = url.replace('https://launchermeta.mojang.com', source.baseUrl);
    }
    // 版本元数据
    else if (url.includes('piston-meta.mojang.com')) {
        transformedUrl = url.replace('https://piston-meta.mojang.com', source.baseUrl);
    }
    // 游戏文件
    else if (url.includes('piston-data.mojang.com')) {
        transformedUrl = url.replace('https://piston-data.mojang.com', source.resourceBaseUrl);
    }
    // 库文件
    else if (url.includes('libraries.minecraft.net')) {
        transformedUrl = url.replace('https://libraries.minecraft.net', source.resourceBaseUrl + '/libraries');
    }
    // 资源文件
    else if (url.includes('resources.download.minecraft.net')) {
        transformedUrl = url.replace('https://resources.download.minecraft.net', source.resourceBaseUrl + '/assets');
    }
    // 旧版资源文件
    else if (url.includes('s3.amazonaws.com/Minecraft.Download')) {
        transformedUrl = url.replace('https://s3.amazonaws.com/Minecraft.Download', source.resourceBaseUrl);
    }
    // 旧版本
    else if (url.includes('s3.amazonaws.com/Minecraft.Resources')) {
        transformedUrl = url.replace('https://s3.amazonaws.com/Minecraft.Resources', source.resourceBaseUrl + '/assets');
    }
    // Maven中央库
    else if (url.includes('repo1.maven.org/maven2')) {
        transformedUrl = url.replace('https://repo1.maven.org/maven2', source.resourceBaseUrl + '/maven');
    }
    // Forge Maven
    else if (url.includes('files.minecraftforge.net/maven')) {
        transformedUrl = url.replace('https://files.minecraftforge.net/maven', source.resourceBaseUrl + '/maven');
    }
    // Fabric Maven
    else if (url.includes('maven.fabricmc.net')) {
        transformedUrl = url.replace('https://maven.fabricmc.net', source.resourceBaseUrl + '/maven');
    }
    // Quilt Maven
    else if (url.includes('maven.quiltmc.org/repository/release')) {
        transformedUrl = url.replace('https://maven.quiltmc.org/repository/release', source.resourceBaseUrl + '/maven');
    }
    // NeoForge Maven
    else if (url.includes('maven.neoforged.net/releases')) {
        transformedUrl = url.replace('https://maven.neoforged.net/releases', source.resourceBaseUrl + '/maven');
    }
    
    return transformedUrl;
}

ipcMain.handle('get_install_path', () => {
    if (!store) return getDefaultInstallPath();
    return store.get('installPath', getDefaultInstallPath());
});

ipcMain.handle('set_install_path', (event, newPath) => {
    if (!store) return false;
    store.set('installPath', newPath);
    return true;
});

ipcMain.handle('get_download_source', () => {
    return getCurrentDownloadSource().name;
});

ipcMain.handle('set_download_source', (event, sourceName) => {
    if (!store) return false;
    if (DOWNLOAD_SOURCES[sourceName]) {
        store.set('downloadSource', sourceName);
        return true;
    }
    return false;
});

// 获取下载设置
ipcMain.handle('get_download_settings', () => {
    if (!store) {
        return {
            concurrentDownloads: 2,
            maxRetries: 5
        };
    }
    return {
        concurrentDownloads: store.get('downloadSettings.concurrentDownloads', 2),
        maxRetries: store.get('downloadSettings.maxRetries', 5)
    };
});

// 设置下载设置
ipcMain.handle('set_download_settings', (event, settings) => {
    if (!store) return false;
    store.set('downloadSettings.concurrentDownloads', settings.concurrentDownloads);
    store.set('downloadSettings.maxRetries', settings.maxRetries);
    return true;
});

let audioPlayer = null;
let currentPlaylist = [];
let currentTrackIndex = 0;

function getMusicDirectory() {
    let simpMcDir;
    
    if (app.isPackaged) {
        // 打包后模式：使用可执行文件所在目录
        const exePath = app.getPath('exe');
        simpMcDir = path.join(path.dirname(exePath), 'SimpMC', 'music');
    } else {
        // 开发模式：使用项目根目录
        simpMcDir = path.join(__dirname, '..', '..', 'SimpMC', 'music');
    }
    
    console.log('[Music] Music directory:', simpMcDir);
    return simpMcDir;
}

function getSupportedAudioFiles() {
    return ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];
}

function scanMusicDirectory() {
    const musicDir = getMusicDirectory();
    
    console.log('[Music] Checking music directory:', musicDir);
    console.log('[Music] Directory exists:', fs.existsSync(musicDir));
    
    // 如果目录不存在，创建它
    if (!fs.existsSync(musicDir)) {
        try {
            fs.mkdirSync(musicDir, { recursive: true });
            console.log('[Music] Created music directory:', musicDir);
        } catch (error) {
            console.error('[Music] Failed to create music directory:', error);
            return [];
        }
    }
    
    try {
        const files = fs.readdirSync(musicDir);
        console.log('[Music] All files in directory:', files);
        
        const audioFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return getSupportedAudioFiles().includes(ext);
        });
        
        console.log('[Music] Audio files found:', audioFiles);
        
        const audioPaths = audioFiles.map(file => path.join(musicDir, file));
        console.log('[Music] Audio paths:', audioPaths);
        return audioPaths;
    } catch (error) {
        console.error('[Music] Error scanning music directory:', error);
        return [];
    }
}

function getRandomTrack(excludeIndex = -1) {
    if (currentPlaylist.length === 0) return null;
    if (currentPlaylist.length === 1) return 0;
    
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * currentPlaylist.length);
    } while (randomIndex === excludeIndex && currentPlaylist.length > 1);
    
    return randomIndex;
}

function playNextTrack() {
    if (!mainWindow) return;
    
    if (currentPlaylist.length === 0) {
        currentPlaylist = scanMusicDirectory();
        if (currentPlaylist.length === 0) {
            console.log('[Music] No music files found');
            return;
        }
    }
    
    const nextIndex = getRandomTrack(currentTrackIndex);
    if (nextIndex === null) return;
    
    currentTrackIndex = nextIndex;
    const trackPath = currentPlaylist[currentTrackIndex];
    
    console.log('[Music] Playing:', trackPath);
    mainWindow.webContents.send('music_ended', {
        filePath: trackPath,
        index: currentTrackIndex,
        total: currentPlaylist.length
    });
}

ipcMain.handle('get_music_settings', () => {
    if (!store) return { enabled: true, volume: 0.5 };
    return {
        enabled: store.get('musicEnabled', true),
        volume: store.get('musicVolume', 0.5)
    };
});

ipcMain.handle('set_music_settings', (event, settings) => {
    if (!store) return false;
    if (settings.enabled !== undefined) {
        store.set('musicEnabled', settings.enabled);
    }
    if (settings.volume !== undefined) {
        store.set('musicVolume', settings.volume);
    }
    return true;
});

ipcMain.handle('set_music_volume', (event, volume) => {
    if (!store) return false;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    store.set('musicVolume', clampedVolume);
    return true;
});

ipcMain.handle('toggle_music', () => {
    if (!store) return false;
    const currentEnabled = store.get('musicEnabled', true);
    store.set('musicEnabled', !currentEnabled);
    return !currentEnabled;
});

ipcMain.handle('skip_to_next_music', () => {
    playNextTrack();
    return true;
});

ipcMain.handle('read_audio_file', async (event, filePath) => {
    try {
        console.log('[Music] Reading audio file:', filePath);
        console.log('[Music] File exists:', fs.existsSync(filePath));
        
        const data = fs.readFileSync(filePath);
        console.log('[Music] File size:', data.length, 'bytes');
        
        const base64 = data.toString('base64');
        console.log('[Music] Base64 length:', base64.length);
        
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
            '.m4a': 'audio/mp4'
        };
        const mimeType = mimeTypes[ext] || 'audio/mpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        console.log('[Music] Data URL length:', dataUrl.length);
        return dataUrl;
    } catch (error) {
        console.error('[Music] Failed to read audio file:', error);
        return null;
    }
});

function getHttpClient(url) {
    return url.startsWith('https://') ? https : http;
}

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const client = getHttpClient(url);
        const req = client.request(url, options, (res) => {
            let data = '';
            
            // 检查响应状态码
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // 处理重定向
                return request(res.headers.location, options).then(resolve).catch(reject);
            }
            
            if (res.statusCode >= 400) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            
            res.setEncoding('utf8');
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                // 验证数据是否为空
                if (!data || data.trim() === '') {
                    return reject(new Error(`Empty response from ${url}`));
                }
                resolve({ res, data });
            });
            res.on('error', reject);
        });
        
        // 添加超时处理
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error(`Request timeout for ${url}`));
        });
        
        req.on('error', reject);
        req.end();
    });
}

ipcMain.handle('get_minecraft_versions', async () => {
    try {
        const source = getCurrentDownloadSource();
        const manifestUrl = transformUrlForSource('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', source);
        console.log('Fetching versions from:', manifestUrl);
        
        const { data } = await request(manifestUrl);
        
        try {
            const manifest = JSON.parse(data);
            return {
                success: true,
                versions: manifest.versions,
                latest: manifest.latest
            };
        } catch (parseError) {
            console.error('JSON parse error, data received:', data.substring(0, 200));
            throw new Error(`Failed to parse version manifest: ${parseError.message}`);
        }
    } catch (error) {
        console.error('Get versions error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get_version_details', async (event, versionId) => {
    try {
        const source = getCurrentDownloadSource();
        const manifestUrl = transformUrlForSource('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', source);
        
        const { data } = await request(manifestUrl);
        const manifest = JSON.parse(data);
        const versionInfo = manifest.versions.find(v => v.id === versionId);
        if (!versionInfo) {
            return { success: false, error: 'Version not found' };
        }
        
        const versionUrl = transformUrlForSource(versionInfo.url, source);
        console.log('Fetching version details from:', versionUrl);
        
        const { data: versionData } = await request(versionUrl);
        
        try {
            return {
                success: true,
                details: JSON.parse(versionData)
            };
        } catch (parseError) {
            console.error('Version details JSON parse error, data received:', versionData.substring(0, 200));
            throw new Error(`Failed to parse version details: ${parseError.message}`);
        }
    } catch (error) {
        console.error('Get version details error:', error);
        return { success: false, error: error.message };
    }
});

function downloadFile(url, destPath, progressCallback, fileId, maxRetries = 5) {
    return new Promise((resolve, reject) => {
        let retryCount = 0;
        
        const download = () => {
            const client = getHttpClient(url);
            let downloadedBytes = 0;
            
            // 添加User-Agent，避免被识别为机器人
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };
            
            client.get(url, options, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return downloadFile(response.headers.location, destPath, progressCallback, fileId, maxRetries).then(resolve).catch(reject);
                }
                
                if (response.statusCode >= 400) {
                    // 对于403和429错误，使用更长的延迟
                    const delayTime = response.statusCode === 403 || response.statusCode === 429 
                        ? (retryCount + 1) * 3000 
                        : (retryCount + 1) * 1000;
                    
                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`下载失败 (HTTP ${response.statusCode})，${delayTime/1000}秒后重试 (${retryCount}/${maxRetries}): ${url}`);
                        setTimeout(download, delayTime);
                        return;
                    }
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                
                const totalBytes = parseInt(response.headers['content-length'] || '0');
                const writeStream = fs.createWriteStream(destPath);
                
                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (progressCallback) {
                        progressCallback({
                            fileId: fileId,
                            downloaded: downloadedBytes,
                            total: totalBytes,
                            progress: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                        });
                    }
                });
                
                response.pipe(writeStream);
                
                writeStream.on('finish', resolve);
                writeStream.on('error', (err) => {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(download, retryCount * 1000);
                        return;
                    }
                    reject(err);
                });
                response.on('error', (err) => {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(download, retryCount * 1000);
                        return;
                    }
                    reject(err);
                });
            }).on('error', (err) => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(download, retryCount * 1000);
                    return;
                }
                reject(err);
            });
        };
        
        download();
    });
}

// 并发下载控制器
async function downloadFilesConcurrently(files, maxConcurrency, maxRetries, sendProgress) {
    const results = [];
    const inProgress = new Set();
    const fileProgress = new Map();
    let completedCount = 0;
    let totalDownloaded = 0;
    let totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    
    // 初始化文件进度
    files.forEach((file, index) => {
        fileProgress.set(index, {
            id: index,
            name: file.name,
            downloaded: 0,
            total: file.size || 0,
            progress: 0,
            status: 'pending'
        });
    });
    
    const updateOverallProgress = () => {
        // 重新计算总下载大小
        totalDownloaded = 0;
        fileProgress.forEach((fp) => {
            totalDownloaded += fp.downloaded;
        });
        
        const overallProgress = totalSize > 0 ? (totalDownloaded / totalSize) * 100 : 0;
        sendProgress({
            type: 'overall',
            downloaded: totalDownloaded,
            total: totalSize,
            progress: overallProgress,
            completed: completedCount,
            totalFiles: files.length,
            files: Array.from(fileProgress.values())
        });
    };
    
    const downloadNext = async (index) => {
        if (index >= files.length || downloadManager.currentDownload?.isCancelled) {
            return;
        }
        
        const file = files[index];
        const fileId = index;
        
        inProgress.add(fileId);
        fileProgress.get(fileId).status = 'downloading';
        
        try {
            if (!fs.existsSync(file.path)) {
                await downloadFile(
                    file.url,
                    file.path,
                    (progress) => {
                        const fp = fileProgress.get(fileId);
                        fp.downloaded = progress.downloaded;
                        fp.progress = progress.progress;
                        fp.total = progress.total || fp.total;
                        updateOverallProgress();
                    },
                    fileId,
                    maxRetries
                );
            } else {
                // 文件已存在，直接标记为完成
                const fp = fileProgress.get(fileId);
                fp.downloaded = fp.total;
                fp.progress = 100;
            }
            
            // 验证文件
            if (file.sha1) {
                fileProgress.get(fileId).status = 'verifying';
                updateOverallProgress();
                const hash = await calculateSha1(file.path);
                if (hash !== file.sha1) {
                    throw new Error(`File verification failed for ${file.name}`);
                }
            }
            
            fileProgress.get(fileId).status = 'completed';
            completedCount++;
            updateOverallProgress();
            results.push({ success: true, file: file });
        } catch (error) {
            console.error(`Failed to download ${file.name}:`, error.message);
            fileProgress.get(fileId).status = 'error';
            results.push({ success: false, file: file, error: error.message });
            updateOverallProgress();
        }
        
        inProgress.delete(fileId);
        
        // 添加小延迟避免触发限流
        await new Promise(r => setTimeout(r, 200));
        
        // 下载下一个
        if (index + maxConcurrency < files.length && !downloadManager.currentDownload?.isCancelled) {
            await downloadNext(index + maxConcurrency);
        }
    };
    
    // 启动初始并发
    const initialPromises = [];
    for (let i = 0; i < Math.min(maxConcurrency, files.length); i++) {
        // 错开启动时间，避免同时请求
        await new Promise(r => setTimeout(r, 150));
        initialPromises.push(downloadNext(i));
    }
    
    await Promise.all(initialPromises);
    
    return results;
}

function calculateSha1(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

ipcMain.handle('start_download', async (event, versionId, options = {}) => {
    try {
        const installPath = store ? store.get('installPath', getDefaultInstallPath()) : getDefaultInstallPath();
        const source = getCurrentDownloadSource();
        
        // 从设置中读取并发数和重试次数
        let maxConcurrency = 2;
        let maxRetries = 5;
        if (store) {
            maxConcurrency = store.get('downloadSettings.concurrentDownloads', 2);
            maxRetries = store.get('downloadSettings.maxRetries', 5);
        }
        
        const isolateVersion = options.isolate !== false; // 默认隔离版本
        
        const manifestUrl = transformUrlForSource('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', source);
        const { data } = await request(manifestUrl);
        const manifest = JSON.parse(data);
        const versionInfo = manifest.versions.find(v => v.id === versionId);
        if (!versionInfo) {
            throw new Error('Version not found');
        }
        const versionUrl = transformUrlForSource(versionInfo.url, source);
        const { data: versionData } = await request(versionUrl);
        const version = JSON.parse(versionData);
        
        downloadManager.currentDownload = {
            versionId: versionId,
            version: version,
            isPaused: false,
            isCancelled: false
        };
        
        const sendProgress = (data) => {
            event.sender.send('download_progress', {
                ...data,
                versionId: versionId
            });
        };
        
        // PCL 2风格的版本隔离目录结构
        const versionDir = path.join(installPath, 'versions', versionId);
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }
        
        // 根据是否隔离选择目录
        let librariesDir, assetsDir, gameDir;
        if (isolateVersion) {
            // 隔离模式：所有文件都在版本目录下
            librariesDir = path.join(versionDir, 'libraries');
            assetsDir = path.join(versionDir, 'assets');
            gameDir = path.join(versionDir, '.minecraft');
        } else {
            // 共享模式：使用全局目录
            librariesDir = path.join(installPath, 'libraries');
            assetsDir = path.join(installPath, 'assets');
            gameDir = path.join(installPath, '.minecraft');
        }
        
        // 创建游戏目录（无论是否隔离）
        const gameSubdirs = ['saves', 'mods', 'resourcepacks', 'config', 'screenshots', 'logs'];
        for (const subdir of gameSubdirs) {
            const dir = path.join(gameDir, subdir);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        
        const jarPath = path.join(versionDir, `${versionId}.jar`);
        const jsonPath = path.join(versionDir, `${versionId}.json`);
        
        // 保存版本JSON，同时添加隔离信息
        const versionWithIsolation = {
            ...version,
            isolation: {
                enabled: isolateVersion,
                gameDir: gameDir,
                librariesDir: librariesDir,
                assetsDir: assetsDir
            }
        };
        fs.writeFileSync(jsonPath, JSON.stringify(versionWithIsolation, null, 2));
        
        // 收集所有需要下载的文件
        const filesToDownload = [];
        
        // 1. 客户端jar
        if (version.downloads && version.downloads.client) {
            const clientUrl = transformUrlForSource(version.downloads.client.url, source);
            filesToDownload.push({
                name: `${versionId}.jar`,
                url: clientUrl,
                path: jarPath,
                sha1: version.downloads.client.sha1,
                size: version.downloads.client.size
            });
        }
        
        // 2. 库文件
        for (const lib of (version.libraries || [])) {
            if (lib.downloads && lib.downloads.artifact) {
                const artifact = lib.downloads.artifact;
                const libPath = path.join(librariesDir, artifact.path);
                const libDir = path.dirname(libPath);
                
                if (!fs.existsSync(libDir)) {
                    fs.mkdirSync(libDir, { recursive: true });
                }
                
                const libUrl = transformUrlForSource(artifact.url, source);
                filesToDownload.push({
                    name: artifact.path.split('/').pop(),
                    url: libUrl,
                    path: libPath,
                    sha1: artifact.sha1,
                    size: artifact.size
                });
            }
        }
        
        // 3. 资源文件索引
        if (version.assetIndex) {
            const assetIndexUrl = transformUrlForSource(version.assetIndex.url, source);
            const assetIndexPath = path.join(assetsDir, 'indexes', `${version.assetIndex.id}.json`);
            const assetIndexDir = path.dirname(assetIndexPath);
            
            if (!fs.existsSync(assetIndexDir)) {
                fs.mkdirSync(assetIndexDir, { recursive: true });
            }
            
            filesToDownload.push({
                name: `${version.assetIndex.id}.json`,
                url: assetIndexUrl,
                path: assetIndexPath,
                sha1: version.assetIndex.sha1,
                size: version.assetIndex.size
            });
            
            // 下载资源索引并收集资源文件
            if (!fs.existsSync(assetIndexPath)) {
                console.log('Fetching asset index from:', assetIndexUrl);
                const { data: assetIndexData } = await request(assetIndexUrl);
                fs.writeFileSync(assetIndexPath, assetIndexData);
                
                let assetIndex;
                try {
                    assetIndex = JSON.parse(assetIndexData);
                } catch (parseError) {
                    console.error('Asset index JSON parse error, data received:', assetIndexData.substring(0, 200));
                    throw new Error(`Failed to parse asset index: ${parseError.message}`);
                }
                
                const objectsDir = path.join(assetsDir, 'objects');
                for (const [hash, asset] of Object.entries(assetIndex.objects || {})) {
                    const assetPath = path.join(objectsDir, hash.substring(0, 2), hash);
                    const assetDir = path.dirname(assetPath);
                    
                    if (!fs.existsSync(assetDir)) {
                        fs.mkdirSync(assetDir, { recursive: true });
                    }
                    
                    const assetUrl = transformUrlForSource(
                        `https://resources.download.minecraft.net/${hash.substring(0, 2)}/${hash}`,
                        source
                    );
                    
                    filesToDownload.push({
                        name: hash,
                        url: assetUrl,
                        path: assetPath,
                        sha1: hash,
                        size: asset.size
                    });
                }
            } else {
                // 索引已存在，收集资源文件
                let assetIndex;
                try {
                    assetIndex = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'));
                } catch (parseError) {
                    console.error('Failed to parse existing asset index:', parseError);
                    throw new Error(`Failed to parse existing asset index: ${parseError.message}`);
                }
                
                const objectsDir = path.join(assetsDir, 'objects');
                
                for (const [hash, asset] of Object.entries(assetIndex.objects || {})) {
                    const assetPath = path.join(objectsDir, hash.substring(0, 2), hash);
                    const assetDir = path.dirname(assetPath);
                    
                    if (!fs.existsSync(assetDir)) {
                        fs.mkdirSync(assetDir, { recursive: true });
                    }
                    
                    const assetUrl = transformUrlForSource(
                        `https://resources.download.minecraft.net/${hash.substring(0, 2)}/${hash}`,
                        source
                    );
                    
                    filesToDownload.push({
                        name: hash,
                        url: assetUrl,
                        path: assetPath,
                        sha1: hash,
                        size: asset.size
                    });
                }
            }
        }
        
        // 开始并发下载
        const results = await downloadFilesConcurrently(filesToDownload, maxConcurrency, maxRetries, sendProgress);
        
        // 检查是否有失败
        const failedFiles = results.filter(r => !r.success);
        if (failedFiles.length > 0) {
            console.warn(`Download completed with ${failedFiles.length} failed files`);
        }
        
        sendProgress({ type: 'complete', message: 'Download complete' });
        
        downloadManager.currentDownload = null;
        
        // 保存版本信息到存储
        saveInstalledVersion(versionId, {
            ...version,
            isolation: {
                enabled: isolateVersion,
                gameDir: gameDir,
                librariesDir: librariesDir,
                assetsDir: assetsDir
            },
            installedAt: new Date().toISOString()
        });
        
        return { success: true, failedCount: failedFiles.length };
    } catch (error) {
        console.error('Download error:', error);
        downloadManager.currentDownload = null;
        return { success: false, error: error.message };
    }
});

// 保存已安装版本信息
function saveInstalledVersion(versionId, versionData) {
    if (!store) return;
    const installedVersions = store.get('installedVersions', {});
    installedVersions[versionId] = versionData;
    store.set('installedVersions', installedVersions);
}

// 获取已安装版本列表
ipcMain.handle('get_installed_versions', () => {
    if (!store) return [];
    const installedVersions = store.get('installedVersions', {});
    return Object.entries(installedVersions).map(([id, data]) => ({
        id,
        ...data
    }));
});

// 删除版本
ipcMain.handle('delete_version', async (event, versionId) => {
    try {
        const installPath = store ? store.get('installPath', getDefaultInstallPath()) : getDefaultInstallPath();
        const versionDir = path.join(installPath, 'versions', versionId);
        
        // 先读取版本信息看看是否是隔离模式
        const versionJsonPath = path.join(versionDir, `${versionId}.json`);
        let versionData = null;
        if (fs.existsSync(versionJsonPath)) {
            try {
                versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
            } catch (e) {}
        }
        
        // 删除版本目录
        if (fs.existsSync(versionDir)) {
            deleteDirectoryRecursive(versionDir);
        }
        
        // 从存储中移除
        if (store) {
            const installedVersions = store.get('installedVersions', {});
            delete installedVersions[versionId];
            store.set('installedVersions', installedVersions);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Delete version error:', error);
        return { success: false, error: error.message };
    }
});

// 复制版本
ipcMain.handle('copy_version', async (event, sourceVersionId, newVersionId) => {
    try {
        const installPath = store ? store.get('installPath', getDefaultInstallPath()) : getDefaultInstallPath();
        const sourceDir = path.join(installPath, 'versions', sourceVersionId);
        const targetDir = path.join(installPath, 'versions', newVersionId);
        
        if (!fs.existsSync(sourceDir)) {
            throw new Error('Source version not found');
        }
        if (fs.existsSync(targetDir)) {
            throw new Error('Target version already exists');
        }
        
        // 复制目录
        copyDirectoryRecursive(sourceDir, targetDir);
        
        // 读取并更新版本JSON
        const versionJsonPath = path.join(targetDir, `${sourceVersionId}.json`);
        const newVersionJsonPath = path.join(targetDir, `${newVersionId}.json`);
        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        versionData.id = newVersionId;
        
        // 如果有隔离的游戏目录，也需要更新
        if (versionData.isolation && versionData.isolation.gameDir) {
            const sourceGameDir = versionData.isolation.gameDir;
            const targetGameDir = path.join(targetDir, '.minecraft');
            versionData.isolation.gameDir = targetGameDir;
            
            // 复制游戏目录
            copyDirectoryRecursive(sourceGameDir, targetGameDir);
        }
        
        fs.writeFileSync(newVersionJsonPath, JSON.stringify(versionData, null, 2));
        
        // 重命名jar文件
        const sourceJarPath = path.join(targetDir, `${sourceVersionId}.jar`);
        const targetJarPath = path.join(targetDir, `${newVersionId}.jar`);
        if (fs.existsSync(sourceJarPath)) {
            fs.renameSync(sourceJarPath, targetJarPath);
        }
        
        // 删除旧的json文件
        if (fs.existsSync(versionJsonPath)) {
            fs.unlinkSync(versionJsonPath);
        }
        
        // 保存到已安装版本
        saveInstalledVersion(newVersionId, {
            ...versionData,
            copiedFrom: sourceVersionId,
            installedAt: new Date().toISOString()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Copy version error:', error);
        return { success: false, error: error.message };
    }
});

// 重命名版本
ipcMain.handle('rename_version', async (event, oldVersionId, newVersionId) => {
    try {
        const installPath = store ? store.get('installPath', getDefaultInstallPath()) : getDefaultInstallPath();
        const oldDir = path.join(installPath, 'versions', oldVersionId);
        const newDir = path.join(installPath, 'versions', newVersionId);
        
        if (!fs.existsSync(oldDir)) {
            throw new Error('Source version not found');
        }
        if (fs.existsSync(newDir)) {
            throw new Error('Target version already exists');
        }
        
        // 重命名目录
        fs.renameSync(oldDir, newDir);
        
        // 读取并更新版本JSON
        const versionJsonPath = path.join(newDir, `${oldVersionId}.json`);
        const newVersionJsonPath = path.join(newDir, `${newVersionId}.json`);
        const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        versionData.id = newVersionId;
        
        // 如果有隔离的游戏目录，也需要更新引用
        if (versionData.isolation && versionData.isolation.gameDir) {
            // 游戏目录在版本文件夹内，不需要移动，只需更新引用
            versionData.isolation.gameDir = path.join(newDir, '.minecraft');
        }
        
        fs.writeFileSync(newVersionJsonPath, JSON.stringify(versionData, null, 2));
        
        // 重命名jar文件
        const oldJarPath = path.join(newDir, `${oldVersionId}.jar`);
        const newJarPath = path.join(newDir, `${newVersionId}.jar`);
        if (fs.existsSync(oldJarPath)) {
            fs.renameSync(oldJarPath, newJarPath);
        }
        
        // 删除旧的json文件
        if (fs.existsSync(versionJsonPath)) {
            fs.unlinkSync(versionJsonPath);
        }
        
        // 更新已安装版本记录
        if (store) {
            const installedVersions = store.get('installedVersions', {});
            const oldData = installedVersions[oldVersionId];
            delete installedVersions[oldVersionId];
            installedVersions[newVersionId] = {
                ...oldData,
                id: newVersionId,
                renamedFrom: oldVersionId,
                renamedAt: new Date().toISOString()
            };
            store.set('installedVersions', installedVersions);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Rename version error:', error);
        return { success: false, error: error.message };
    }
});

// 递归删除目录
function deleteDirectoryRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteDirectoryRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

// 递归复制目录
function copyDirectoryRecursive(sourceDir, targetDir) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        
        if (fs.lstatSync(sourcePath).isDirectory()) {
            copyDirectoryRecursive(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

ipcMain.handle('pause_download', () => {
    if (downloadManager.currentDownload) {
        downloadManager.currentDownload.isPaused = true;
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('resume_download', () => {
    if (downloadManager.currentDownload) {
        downloadManager.currentDownload.isPaused = false;
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('cancel_download', () => {
    if (downloadManager.currentDownload) {
        downloadManager.currentDownload.isCancelled = true;
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('select_install_directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Installation Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});