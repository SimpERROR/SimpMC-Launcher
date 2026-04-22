let currentOnboardingStep = 1;
const totalOnboardingSteps = 6;
let createdCharacterData = null;
let cachedProfiles = [];
let currentPage = 'home';
let skinview3dLoaded = false;

function loadSkinview3dLibrary() {
    return new Promise((resolve, reject) => {
        if (skinview3dLoaded && window.skinview3d) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = '../assets/js/skinview3d.bundle.js';
        script.onload = () => {
            skinview3dLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function checkFirstRun() {
    try {
        const isFirstRun = await window.simpmcAPI.checkFirstRun();
        return isFirstRun;
    } catch (error) {
        console.error('检查首次运行状态失败:', error);
        return true;
    }
}

function showOnboardingStep(step) {
    document.querySelectorAll('.onboarding-step').forEach((el, index) => {
        el.classList.remove('active');
        if (index + 1 === step) {
            el.classList.add('active');
        }
    });
}

async function onboardingNext() {
    if (currentOnboardingStep < totalOnboardingSteps) {
        currentOnboardingStep++;
        showOnboardingStep(currentOnboardingStep);
        updateNavigationButtons();
        
        // 当进入最后一步时，触发彩带效果
        if (currentOnboardingStep === 6) {
            setTimeout(() => {
                createConfetti();
            }, 500);
        }
    }
}

function onboardingBack() {
    if (currentOnboardingStep > 1) {
        currentOnboardingStep--;
        showOnboardingStep(currentOnboardingStep);
        updateNavigationButtons();
    }
}

function openCharacterCreator() {
    const selectedCard = document.querySelector('.character-card.selected');
    if (!selectedCard) return;
    
    const characterType = selectedCard.getAttribute('data-value');
    
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.disabled = true;
    
    window.simpmcAPI.openCharacterWindow(characterType);
}

function updateNavigationButtons() {
    const nextBtn = document.getElementById('next-btn');
    
    if (!nextBtn) return;
    
    if (currentOnboardingStep === 4) {
        const selectedCharacter = document.querySelector('.character-card.selected');
        nextBtn.disabled = !selectedCharacter;
    } else {
        nextBtn.disabled = false;
    }
}

async function finishOnboarding() {
    const appLocale = document.querySelector('input[name="language"]:checked').value;
    
    try {
        await window.simpmcAPI.finishOnboarding({
            appLocale: appLocale,
            character: createdCharacterData
        });
        
        const onboardingContainer = document.getElementById('onboarding-container');
        const menuContainer = document.getElementById('menu-container');
        const pageContent = document.getElementById('page-content');
        
        // 确保所有容器正确显示
        if (onboardingContainer) {
            onboardingContainer.style.display = 'none';
            onboardingContainer.style.zIndex = '0';
        }
        if (menuContainer) {
            menuContainer.style.display = 'flex';
        }
        if (pageContent) {
            pageContent.style.display = 'block';
            pageContent.style.zIndex = '1';
        }
        
        await switchPage('home');
    } catch (error) {
        console.error('保存设置失败:', error);
    }
}

async function setupLanguageCards() {
    const languageCards = document.querySelectorAll('.language-card:not(.disabled)');
    
    languageCards.forEach(card => {
        card.addEventListener('click', function() {
            languageCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
        });
    });
    
    // 检查之前保存的语言设置
    let savedLocale = null;
    try {
        savedLocale = await window.simpmcAPI.getAppLocale();
    } catch (e) {
        console.error('获取保存的语言失败:', e);
    }
    
    if (savedLocale) {
        const selectedCard = document.querySelector(`.language-card[data-value="${savedLocale}"]`);
        if (selectedCard) {
            languageCards.forEach(c => c.classList.remove('selected'));
            selectedCard.classList.add('selected');
            const radio = selectedCard.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
            return;
        }
    }
    
    // 如果没有保存的语言，则选择第一个
    const firstCard = document.querySelector('.language-card:not(.disabled)');
    if (firstCard) {
        firstCard.classList.add('selected');
        const radio = firstCard.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
        }
    }
}

function setupCharacterCards() {
    const characterCards = document.querySelectorAll('.character-card');
    
    characterCards.forEach(card => {
        if (card.classList.contains('disabled')) {
            return;
        }
        
        card.addEventListener('click', function() {
            characterCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
            updateNavigationButtons();
        });
    });
    
    const firstCard = document.querySelector('.character-card:not(.disabled)');
    if (firstCard) {
        firstCard.classList.add('selected');
        const radio = firstCard.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
        }
        updateNavigationButtons();
    }
}

async function initApp() {
    await applyTranslations();
    
    const onboardingContainer = document.getElementById('onboarding-container');
    const menuContainer = document.getElementById('menu-container');
    const pageContent = document.getElementById('page-content');
    
    const isFirstRun = await checkFirstRun();
    if (isFirstRun) {
        if (onboardingContainer) {
            onboardingContainer.style.display = 'block';
            onboardingContainer.style.zIndex = '10';
        }
        if (menuContainer) {
            menuContainer.style.display = 'none';
        }
        if (pageContent) {
            pageContent.style.display = 'none';
        }
        showOnboardingStep(1);
        await setupLanguageCards();
        setupCharacterCards();
    } else {
        if (onboardingContainer) {
            onboardingContainer.style.display = 'none';
            onboardingContainer.style.zIndex = '0';
        }
        if (menuContainer) {
            menuContainer.style.display = 'flex';
        }
        if (pageContent) {
            pageContent.style.display = 'block';
            pageContent.style.zIndex = '1';
        }
        await switchPage('home');
    }
    
    // 监听角色窗口关闭事件
    window.simpmcAPI.onCharacterWindowClosed(() => {
        updateNavigationButtons();
        if (currentPage === 'profiles') {
            loadProfiles();
        }
    });
    
    // 监听角色创建完成事件
    console.log('设置 onCharacterCreated 监听器');
    window.simpmcAPI.onCharacterCreated((characterData) => {
        console.log('角色创建成功:', characterData);
        console.log('当前步骤:', currentOnboardingStep);
        createdCharacterData = characterData;
        // 自动进入下一步
        if (currentOnboardingStep === 4) {
            console.log('跳转到下一步');
            onboardingNext();
        }
    });
    
    // 监听音乐结束事件，用于显示歌曲切换指示器并播放音乐
    window.simpmcAPI.onMusicEnded((event, data) => {
        console.log('[Music] Received music_ended event in renderer');
        
        if (data && data.filePath) {
            const songName = data.filePath.split(/[\\/]/).pop();
            // 去除文件扩展名
            const songNameWithoutExt = songName.replace(/\.[^/.]+$/, "");
            console.log('[Music] Song name:', songNameWithoutExt);
            showSongIndicator(songNameWithoutExt, data.total || 0);
            
            // 传递 totalSongs 参数给 playAudioFile
            playAudioFile(data.filePath, data.total);
        }
    });
    
    console.log('[Music] Event listener registered');
    
    // 初始化完成后，如果音乐开关是开启的，请求播放音乐
    setTimeout(async () => {
        const settings = await window.simpmcAPI.getMusicSettings();
        if (settings.enabled) {
            console.log('[Music] Auto-playing music on init');
            await window.simpmcAPI.requestPlayMusic();
        }
    }, 500);
}

// 音乐播放器
let audioPlayer = null;
let currentTotalSongs = 0;
let currentPlayingSong = ''; // 保存当前播放的歌曲名称

async function playAudioFile(filePath, totalSongs = 1) {
    try {
        const settings = await window.simpmcAPI.getMusicSettings();
        
        // 更新总歌曲数
        if (totalSongs > 0) {
            currentTotalSongs = totalSongs;
        }
        
        if (!settings.enabled) {
            console.log('[Music] Music is disabled');
            return;
        }
        
        // 显示歌曲指示器
        const songName = filePath.split(/[\\/]/).pop();
        // 去除文件扩展名
        const songNameWithoutExt = songName.replace(/\.[^/.]+$/, "");
        currentPlayingSong = songNameWithoutExt; // 保存当前歌曲名称
        showSongIndicator(songNameWithoutExt, currentTotalSongs);
        updatePersonalizationMusicInfo(songNameWithoutExt); // 更新个性化页面的音乐信息
        updateMusicFloatInfo(); // 更新音乐浮窗的歌曲信息
        
        if (!audioPlayer) {
            audioPlayer = new Audio();
            audioPlayer.addEventListener('ended', async () => {
                console.log('[Music] Track ended');
                await window.simpmcAPI.skipToNextMusic();
            });
            audioPlayer.addEventListener('canplaythrough', () => {
                console.log('[Music] Audio can play through');
            });
            audioPlayer.addEventListener('loadedmetadata', () => {
                console.log('[Music] Audio loaded metadata, duration:', audioPlayer.duration);
            });
            audioPlayer.addEventListener('play', () => {
                console.log('[Music] Audio started playing');
                updatePlayPauseButton();
            });
            audioPlayer.addEventListener('pause', () => {
                console.log('[Music] Audio paused');
                updatePlayPauseButton();
            });
            audioPlayer.addEventListener('error', (e) => {
                console.error('[Music] Audio error:', e);
                console.error('[Music] Error code:', audioPlayer.error?.code);
                console.error('[Music] Error message:', audioPlayer.error?.message);
            });
        }
        
        audioPlayer.volume = settings.volume;
        console.log('[Music] Volume set to:', settings.volume);
        
        // 通过 Node.js 读取文件并转换为 base64 URL，避免中文路径问题
        const dataUrl = await window.simpmcAPI.readAudioFile(filePath);
        if (!dataUrl) {
            console.error('[Music] Failed to read audio file - dataUrl is null');
            return;
        }
        
        console.log('[Music] Data URL received, length:', dataUrl.length);
        audioPlayer.src = dataUrl;
        
        console.log('[Music] Calling play()');
        try {
            await audioPlayer.play();
            console.log('[Music] Play promise resolved successfully');
        } catch (playError) {
            console.error('[Music] Play promise rejected:', playError);
        }
    } catch (error) {
        console.error('[Music] Failed to play audio:', error);
    }
}

// 生成彩带效果
function createConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 彩带颜色
    const colors = ['#1976D2', '#4CAF50', '#FFC107', '#F44336', '#9C27B0', '#2196F3', '#00BCD4', '#8BC34A'];
    
    // 创建 200 个彩带
    for (let i = 0; i < 200; i++) {
        createConfettiParticle(container, colors);
    }
}

function createConfettiParticle(container, colors) {
    const particle = document.createElement('div');
    
    // 随机大小
    const size = Math.random() * 10 + 5;
    
    // 随机颜色
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // 随机位置
    const startX = Math.random() * 100;
    
    // 设置样式
    particle.style.cssText = `
        position: absolute;
        top: -${size}px;
        left: ${startX}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        opacity: ${Math.random() * 0.5 + 0.5};
        pointer-events: none;
        z-index: 10;
    `;
    
    container.appendChild(particle);
    
    // 动画
    const duration = Math.random() * 3 + 2;
    const endY = container.offsetHeight + size;
    const endX = startX + (Math.random() - 0.5) * 50;
    
    particle.animate([
        { transform: `translate(0, 0) rotate(0deg)` },
        { transform: `translate(${endX}%, ${endY}px) rotate(${Math.random() * 720}deg)` }
    ], {
        duration: duration * 1000,
        easing: 'cubic-bezier(0.1, 0.5, 0.9, 0.5)'
    });
    
    // 动画结束后移除
    setTimeout(() => {
        particle.remove();
    }, duration * 1000);
}

const pageCache = {};

async function updateGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    const sloganEl = document.getElementById('slogan');
    
    if (!greetingEl || !sloganEl) {
        console.warn('greeting or slogan element not found');
        return;
    }
    
    let baseGreeting = '';
    if (hour >= 5 && hour < 8) {
        baseGreeting = i18n('greeting.morning');
        sloganEl.textContent = i18n('slogan.morning');
    } else if (hour >= 8 && hour < 11) {
        baseGreeting = i18n('greeting.midmorning');
        sloganEl.textContent = i18n('slogan.midmorning');
    } else if (hour >= 11 && hour < 13) {
        baseGreeting = i18n('greeting.noon');
        sloganEl.textContent = i18n('slogan.noon');
    } else if (hour >= 13 && hour < 18) {
        baseGreeting = i18n('greeting.afternoon');
        sloganEl.textContent = i18n('slogan.afternoon');
    } else if (hour >= 18 && hour < 21) {
        baseGreeting = i18n('greeting.dusk');
        sloganEl.textContent = i18n('slogan.dusk');
    } else if (hour >= 21 && hour < 24) {
        baseGreeting = i18n('greeting.evening');
        sloganEl.textContent = i18n('slogan.evening');
    } else {
        baseGreeting = i18n('greeting.night');
        sloganEl.textContent = i18n('slogan.night');
    }
    
    let displayName = null;
    try {
        displayName = await window.simpmcAPI.getDisplayName();
        if (!displayName) {
            displayName = await window.simpmcAPI.getSystemUsername();
        }
    } catch (e) {
        console.error('获取显示名称失败:', e);
    }
    
    greetingEl.textContent = displayName ? `${baseGreeting}${displayName} 。` : baseGreeting;
}

async function switchPage(pageName) {
    currentPage = pageName;
    const menuIcons = document.querySelectorAll('.menu-icon');
    menuIcons.forEach(icon => {
        icon.classList.remove('active');
        if (icon.dataset.page === pageName) {
            icon.classList.add('active');
        }
    });
    
    const pageContent = document.getElementById('page-content');
    // 确保 pageContent 容器可见
    if (pageContent) {
        pageContent.style.display = 'block';
        pageContent.style.zIndex = '1';
    }
    
    try {
        if (!pageCache[pageName]) {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName} page`);
            }
            pageCache[pageName] = await response.text();
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pageCache[pageName];
        
        document.querySelectorAll('style[id^="dynamic-style-"]').forEach(el => el.remove());
        document.querySelectorAll('link[data-page]').forEach(el => el.remove());
        
        const styleLink = tempDiv.querySelector('link[rel="stylesheet"]');
        if (styleLink) {
            const href = styleLink.getAttribute('href');
            let existingLink = document.querySelector(`link[data-page="${pageName}"]`);
            if (!existingLink) {
                existingLink = document.createElement('link');
                existingLink.setAttribute('data-page', pageName);
                existingLink.rel = 'stylesheet';
                document.head.appendChild(existingLink);
            }
            existingLink.href = href;
        }
        
        const styleTag = tempDiv.querySelector('style');
        if (styleTag) {
            const cssContent = styleTag.textContent;
            const styleId = `dynamic-style-${pageName}`;
            let dynamicStyle = document.getElementById(styleId);
            if (dynamicStyle) {
                dynamicStyle.textContent = cssContent;
            } else {
                dynamicStyle = document.createElement('style');
                dynamicStyle.id = styleId;
                dynamicStyle.textContent = cssContent;
                document.head.appendChild(dynamicStyle);
            }
        }
        
        pageContent.innerHTML = tempDiv.innerHTML;
        await applyTranslations();

        // 针对部分页面，运行特定函数
        if (pageName === 'home') {
            updateGreeting();
            if (window.loadHomePage) {
                loadHomePage();
            }
            loadProfilesForHomePage();
        } else if (pageName === 'profiles') {
            loadProfiles();
        } else if (pageName === 'wardrobe') {
            loadWardrobe();
        } else if (pageName === 'skin-preview') {
            loadSkinPreview();
        } else if (pageName === 'download') {
            loadDownloadPage();
        } else if (pageName === 'versions') {
            if (window.loadVersionsPage) {
                loadVersionsPage();
            }
        } else if (pageName === 'settings') {
            // 加载设置页面不需要额外操作
        } else if (pageName === 'download-settings') {
            loadDownloadSettingsPage();
        } else if (pageName === 'personalization') {
            loadPersonalizationPage();
        } else if (pageName === 'discovery') {
            loadCarousel()        
        }
    } catch (error) {
        console.error('Error loading page:', error);
        if (pageContent) {
            pageContent.innerHTML = '<p>页面加载失败</p>';
        }
    }
}

// 下载设置相关函数
async function loadDownloadSettingsPage() {
    try {
        const installPath = await window.simpmcAPI.getInstallPath();
        const downloadSource = await window.simpmcAPI.getDownloadSource();
        const settings = await window.simpmcAPI.getDownloadSettings();
        
        document.getElementById('install-path-input').value = installPath;
        document.getElementById('download-source-select').value = downloadSource;
        document.getElementById('concurrent-downloads-select').value = settings.concurrentDownloads || 2;
        document.getElementById('max-retries-select').value = settings.maxRetries || 5;
    } catch (error) {
        console.error('Failed to load download settings:', error);
    }
}

async function selectInstallPath() {
    try {
        const newPath = await window.simpmcAPI.selectInstallDirectory();
        if (newPath) {
            document.getElementById('install-path-input').value = newPath;
            await saveDownloadSettings();
        }
    } catch (error) {
        console.error('Failed to select install path:', error);
    }
}

async function saveDownloadSettings() {
    try {
        const installPath = document.getElementById('install-path-input').value;
        const downloadSource = document.getElementById('download-source-select').value;
        const concurrentDownloads = parseInt(document.getElementById('concurrent-downloads-select').value);
        const maxRetries = parseInt(document.getElementById('max-retries-select').value);
        
        await window.simpmcAPI.setInstallPath(installPath);
        await window.simpmcAPI.setDownloadSource(downloadSource);
        await window.simpmcAPI.setDownloadSettings({
            concurrentDownloads,
            maxRetries
        });
        
        showSaveStatus('设置已保存');
    } catch (error) {
        console.error('Failed to save download settings:', error);
        showSaveStatus('保存失败：' + error.message, true);
    }
}

function showSaveStatus(message, isError = false) {
    const saveStatus = document.getElementById('save-status');
    const saveMessage = document.getElementById('save-message');
    
    if (saveStatus && saveMessage) {
        saveMessage.textContent = message;
        saveStatus.className = 'save-status';
        if (isError) {
            saveStatus.classList.add('error');
        }
        
        saveStatus.classList.add('show');
        
        setTimeout(() => {
            saveStatus.classList.remove('show');
        }, 3000);
    }
}

async function loadPersonalizationPage() {
    try {
        const displayName = await window.simpmcAPI.getDisplayName();
        const displayNameInput = document.getElementById('display-name-input');
        if (displayNameInput) {
            displayNameInput.value = displayName || '';
        }
        
        const musicSettings = await window.simpmcAPI.getMusicSettings();
        const musicToggle = document.getElementById('music-toggle');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (musicToggle) {
            if (musicSettings.enabled) {
                musicToggle.classList.add('active');
            } else {
                musicToggle.classList.remove('active');
            }
        }
        
        if (volumeSlider) {
            volumeSlider.value = Math.round(musicSettings.volume * 100);
        }
        
        // 更新当前播放的音乐信息
        if (currentPlayingSong) {
            updatePersonalizationMusicInfo(currentPlayingSong);
        }
    } catch (error) {
        console.error('Failed to load personalization settings:', error);
    }
}

async function saveDisplayName() {
    try {
        const displayNameInput = document.getElementById('display-name-input');
        if (displayNameInput) {
            const displayName = displayNameInput.value;
            await window.simpmcAPI.setDisplayName(displayName);
            showSaveStatus('设置已保存');
        }
    } catch (error) {
        console.error('Failed to save display name:', error);
        showSaveStatus('保存失败：' + error.message, true);
    }
}

async function toggleMusic() {
    try {
        const newState = await window.simpmcAPI.toggleMusic();
        const musicToggle = document.getElementById('music-toggle');
        if (musicToggle) {
            if (newState) {
                musicToggle.classList.add('active');
                // 如果开启音乐，立即播放
                if (audioPlayer) {
                    audioPlayer.play().catch(err => console.error('[Music] Play error:', err));
                } else {
                    // 触发一次播放
                    window.simpmcAPI.skipToNextMusic();
                }
            } else {
                musicToggle.classList.remove('active');
                // 如果关闭音乐，停止播放
                if (audioPlayer) {
                    audioPlayer.pause();
                    audioPlayer.currentTime = 0;
                }
            }
        }
    } catch (error) {
        console.error('Failed to toggle music:', error);
    }
}

// 音量指示器的定时器ID
let volumeIndicatorTimeout = null;

function showVolumeIndicator(volumePercent) {
    const indicator = document.getElementById('volume-indicator');
    const fill = document.getElementById('volume-indicator-fill');
    const percent = document.getElementById('volume-indicator-percent');
    
    if (indicator && fill && percent) {
        // 清除之前的定时器，避免闪烁
        if (volumeIndicatorTimeout) {
            clearTimeout(volumeIndicatorTimeout);
        }
        
        // 更新显示
        fill.style.width = `${volumePercent}%`;
        percent.textContent = `${volumePercent}%`;
        indicator.classList.add('show');
        
        // 设置新的定时器
        volumeIndicatorTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

function showSongIndicator(songName, totalSongs) {
    const indicator = document.getElementById('song-indicator');
    const title = document.getElementById('song-indicator-title');
    const info = document.getElementById('song-indicator-info');
    const nextBtn = document.getElementById('song-indicator-next');
    
    if (indicator && title && info) {
        // 临时移除 data-i18n 属性，防止被翻译库重置
        const titleI18n = title.getAttribute('data-i18n');
        title.removeAttribute('data-i18n');
        
        // 清除之前的滚动类
        title.classList.remove('marquee');
        title.textContent = songName;
        info.textContent = i18n('music.now_playing');
        
        // 检查歌曲名称是否过长需要滚动
        setTimeout(() => {
            if (title.scrollWidth > title.parentElement.clientWidth) {
                // 如果文本溢出，启用滚动
                title.classList.add('marquee');
                // 复制文本以创建无缝滚动
                title.textContent = songName + '    ' + songName;
            }
        }, 100);
        
        // 始终显示下一首按钮（由调用者决定是否可见）
        if (totalSongs > 1) {
            nextBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'none';
        }
        
        indicator.classList.add('show');
        
        // 显示8秒后隐藏（足够看完歌曲名并点击下一首）
        setTimeout(() => {
            indicator.classList.remove('show');
            // 恢复 data-i18n 属性
            if (titleI18n) {
                title.setAttribute('data-i18n', titleI18n);
            }
        }, 8000);
    }
}

// 更新个性化页面中的当前播放音乐信息
function updatePersonalizationMusicInfo(songName) {
    const musicInfoText = document.getElementById('music-info-text');
    if (musicInfoText) {
        musicInfoText.textContent = songName;
        musicInfoText.classList.add('playing');
    }
}

async function setMusicVolume(volumePercent) {
    try {
        const volumeValue = Math.max(0, Math.min(100, parseInt(volumePercent) || 0));
        const volume = volumeValue / 100;
        await window.simpmcAPI.setMusicVolume(volume);
        if (audioPlayer) {
            audioPlayer.volume = volume;
        }
        showVolumeIndicator(volumeValue);
    } catch (error) {
        console.error('Failed to set music volume:', error);
    }
}

async function skipToNextMusic() {
    try {
        await window.simpmcAPI.skipToNextMusic();
    } catch (error) {
        console.error('Failed to skip to next music:', error);
    }
}

function openProfileManagement() {
    switchPage('profiles');
}

function openLanguageSelection() {
    switchPage('language-settings');
}

async function loadProfiles() {
    try {
        const data = await window.simpmcAPI.getProfiles();
        const profileList = document.getElementById('profile-list');
        if (!profileList) return;
        
        const profiles = data.profiles || [];
        const currentCharacter = data.currentCharacter;
        cachedProfiles = profiles;
        
        const typeSelect = document.getElementById('profile-type-select');
        if (typeSelect) {
            const options = typeSelect.querySelectorAll('option');
            options.forEach(opt => {
                const i18nKey = opt.getAttribute('data-i18n');
                if (i18nKey) {
                    const translation = i18n(i18nKey);
                    if (translation) {
                        opt.textContent = translation;
                    }
                }
            });
        }
        
        if (profiles.length === 0) {
            profileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <p data-i18n="profile.empty"></p>
                </div>
            `;
            applyTranslations();
            return;
        }
        
        profileList.innerHTML = profiles.map(profile => {
            const isCurrent = currentCharacter && currentCharacter.id === profile.id;
            const avatar = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
            const typeText = profile.type === 'offline' ? i18n('auth.offline_character') :
                           profile.type === 'microsoft' ? i18n('auth.official_character') : '未知';
            const canEdit = profile.type === 'offline';
            
            return `
                <div class="profile-card" data-id="${profile.id}">
                    <div class="profile-avatar">${avatar}</div>
                    <div class="profile-info">
                        <div class="profile-name">${profile.name}${isCurrent ? ' ✓' : ''}</div>
                        <div class="profile-type">${typeText}</div>
                    </div>
                    <div class="profile-actions">
                        ${canEdit ? `
                        <button class="profile-action-btn edit" onclick="editProfile('${profile.id}')" title="编辑">
                            <img src="../assets/icon/pen-solid-full.svg" alt="">
                        </button>
                        ` : ''}
                        <button class="profile-action-btn launch" onclick="launchProfile('${profile.id}')" title="启动">
                            <img src="../assets/icon/play-solid-full.svg" alt="">
                        </button>
                        <button class="profile-action-btn delete" onclick="deleteProfile('${profile.id}')" title="删除">
                            <img src="../assets/icon/trash-can-solid-full.svg" alt="">
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load profiles:', error);
    }
}

function addNewProfile() {
    const typeSelect = document.getElementById('profile-type-select');
    const type = typeSelect ? typeSelect.value : 'offline';
    window.simpmcAPI.openCharacterWindow(type);
}

let currentWardrobeTab = 'skin';
let cachedWardrobe = { skins: [], capes: [] };

async function loadWardrobe() {
    try {
        const data = await window.simpmcAPI.getWardrobe();
        cachedWardrobe = data;
        
        if (data.skins.length === 0) {
            await window.simpmcAPI.addWardrobeItem({ id: 'steve', name: 'Steve', type: 'skin', isDefault: true });
            await window.simpmcAPI.addWardrobeItem({ id: 'alex', name: 'Alex', type: 'skin', isDefault: true });
            cachedWardrobe.skins = [
                { id: 'steve', name: 'Steve', type: 'skin', isDefault: true },
                { id: 'alex', name: 'Alex', type: 'skin', isDefault: true }
            ];
        }
        
        renderWardrobe();
    } catch (error) {
        console.error('Failed to load wardrobe:', error);
    }
}

function renderWardrobe() {
    const grid = document.getElementById('wardrobe-grid');
    if (!grid) return;

    const items = currentWardrobeTab === 'skin' ? cachedWardrobe.skins : cachedWardrobe.capes;

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${currentWardrobeTab === 'skin' ? '👕' : '🧥'}</div>
                <p data-i18n="wardrobe.empty"></p>
            </div>
        `;
        applyTranslations();
        return;
    }

    grid.innerHTML = items.map(item => {
        let previewContent = '';
        if (item.id === 'steve') {
            previewContent = `<img src="../assets/icon/steve.png" alt="Steve" class="skin-head">`;
        } else if (item.id === 'alex') {
            previewContent = `<img src="../assets/icon/alex.png" alt="Alex" class="skin-head">`;
        } else if (item.filePath) {
            previewContent = `<img src="file://${item.filePath}" alt="${item.name}" class="skin-head">`;
        } else {
            previewContent = currentWardrobeTab === 'skin' ? '👕' : '🧥';
        }
        return `
        <div class="wardrobe-item" data-id="${item.id}" onclick="openSkinPreview('${item.id}', '${currentWardrobeTab}')">
            <div class="wardrobe-preview">
                ${previewContent}
            </div>
            <div class="wardrobe-name">${item.name}</div>
            <div class="wardrobe-type">${item.isDefault ? (currentWardrobeTab === 'skin' ? i18n('wardrobe.default_skin') : i18n('wardrobe.default_cape')) : i18n('wardrobe.custom')}</div>
            ${!item.isDefault ? `
            <div class="wardrobe-item-actions" onclick="event.stopPropagation();">
                <button class="wardrobe-action-btn edit" onclick="editWardrobeItem('${item.id}')" title="编辑">
                    <img src="../assets/icon/pen-solid-full.svg" alt="">
                </button>
                <button class="wardrobe-action-btn delete" onclick="deleteWardrobeItem('${item.id}')" title="删除">
                    <img src="../assets/icon/trash-can-solid-full.svg" alt="">
                </button>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

function openSkinPreview(itemId, type) {
    const items = type === 'skin' ? cachedWardrobe.skins : cachedWardrobe.capes;
    const item = items.find(i => i.id === itemId);
    if (item) {
        window.skinPreviewData = item;
        switchPage('skin-preview');
    }
}

function switchWardrobeTab(tab) {
    currentWardrobeTab = tab;
    document.querySelectorAll('.wardrobe-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === tab);
    });
    renderWardrobe();
}

function openAddItemModal() {
    const modal = document.getElementById('item-modal');
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('item-name-input');
    const skinPreviewArea = document.getElementById('skin-preview-area');
    const capePreviewArea = document.getElementById('cape-preview-area');
    
    title.textContent = currentWardrobeTab === 'skin' ? i18n('wardrobe.add_skin') : i18n('wardrobe.add_cape');
    nameInput.value = '';
    skinPreviewArea.style.display = currentWardrobeTab === 'skin' ? 'block' : 'none';
    capePreviewArea.style.display = currentWardrobeTab === 'cape' ? 'block' : 'none';
    document.getElementById('skin-preview').textContent = '';
    document.getElementById('cape-preview').textContent = '';
    
    modal.classList.remove('hidden');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
}

let selectedSkinFile = null;
let selectedCapeFile = null;

async function handleSkinFileSelect(event) {
    const filePath = await window.simpmcAPI.selectSkinFile();
    if (filePath) {
        selectedSkinFile = filePath;
        document.getElementById('skin-preview').textContent = i18n('wardrobe.selected_file') + ': ' + filePath.split(/[/\\]/).pop();
    }
}

async function handleCapeFileSelect(event) {
    const filePath = await window.simpmcAPI.selectCapeFile();
    if (filePath) {
        selectedCapeFile = filePath;
        document.getElementById('cape-preview').textContent = i18n('wardrobe.selected_file') + ': ' + filePath.split(/[/\\]/).pop();
    }
}

async function confirmAddItem() {
    const nameInput = document.getElementById('item-name-input');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert(getTranslation('wardrobe.enter_name'));
        return;
    }
    
    const item = {
        name: name,
        type: currentWardrobeTab,
        preview: currentWardrobeTab === 'skin' ? i18n('wardrobe.skin_preview') : i18n('wardrobe.cape_preview')
    };
    
    if (currentWardrobeTab === 'skin' && selectedSkinFile) {
        item.filePath = selectedSkinFile;
    }
    
    if (currentWardrobeTab === 'cape' && selectedCapeFile) {
        item.filePath = selectedCapeFile;
    }
    
    await window.simpmcAPI.addWardrobeItem(item);
    closeItemModal();
    selectedSkinFile = null;
    selectedCapeFile = null;
    await loadWardrobe();
}

async function editWardrobeItem(itemId) {
    const items = currentWardrobeTab === 'skin' ? cachedWardrobe.skins : cachedWardrobe.capes;
    const item = items.find(i => i.id === itemId);
    if (item) {
        window.skinPreviewData = item;
        switchPage('skin-preview');
    }
}

async function deleteWardrobeItem(itemId) {
    const items = currentWardrobeTab === 'skin' ? cachedWardrobe.skins : cachedWardrobe.capes;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    window.pendingDeleteItem = { id: itemId, name: item.name };
    const modal = document.getElementById('delete-modal');
    const nameEl = document.getElementById('delete-item-name');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    if (modal && nameEl && confirmBtn) {
        nameEl.textContent = `"${item.name}"`;
        confirmBtn.onclick = async () => {
            await window.simpmcAPI.deleteWardrobeItem(itemId, currentWardrobeTab);
            closeDeleteModal();
            await loadWardrobe();
        };
        modal.classList.remove('hidden');
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    window.pendingDeleteItem = null;
}

let currentSkinData = null;
let skinViewer = null;

async function loadSkinPreview() {
    currentSkinData = window.skinPreviewData;
    if (!currentSkinData) {
        switchPage('wardrobe');
        return;
    }

    const viewerContainer = document.getElementById('skin-viewer');
    if (!viewerContainer) return;

    if (skinViewer) {
        skinViewer.dispose();
        skinViewer = null;
    }

    await loadSkinview3dLibrary();

    let skinSrc = '../assets/icon/steve.png';
    if (currentSkinData.id === 'steve') {
        skinSrc = '../assets/icon/steve.png';
    } else if (currentSkinData.id === 'alex') {
        skinSrc = '../assets/icon/alex.png';
    } else if (currentSkinData.filePath) {
        skinSrc = 'file://' + currentSkinData.filePath;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400;
        skinViewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: 300,
            height: 400,
            skin: skinSrc
        });
        skinViewer.camera.position.set(0, 35, 55);
        skinViewer.fov = 30;
        skinViewer.autoRotate = false;
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(canvas);
    } catch (e) {
        console.error('Failed to load skin viewer:', e);
    }

    const nameInput = document.getElementById('skin-name-input');
    if (nameInput) {
        nameInput.value = currentSkinData.name || '';
        if (currentSkinData.isDefault) {
            nameInput.disabled = true;
            nameInput.style.opacity = '0.5';
            nameInput.style.cursor = 'not-allowed';
        } else {
            nameInput.addEventListener('change', saveSkinName);
        }
    }

    loadProfilesForAssignment();
}

function rotateSkin(degrees) {
    if (skinViewer) {
        skinViewer.player.rotation.y += degrees * Math.PI / 180;
    }
}

function resetSkinRotation() {
    if (skinViewer) {
        skinViewer.player.rotation.y = 0;
        skinViewer.player.rotation.x = 0;
    }
}

// 音乐浮窗相关函数
async function openMusicFloat() {
    const settings = await window.simpmcAPI.getMusicSettings();
    if (!settings.enabled) {
        // 显示音乐功能未开启的提示
        const hint = document.getElementById('music-float-hint');
        if (hint) {
            hint.classList.add('show');
            setTimeout(() => {
                hint.classList.remove('show');
            }, 3000);
        }
        return;
    }
    
    // 显示浮窗
    const overlay = document.getElementById('music-float-overlay');
    const floatWindow = document.getElementById('music-float');
    const mainContainer = document.querySelector('.main-container');
    
    if (overlay && floatWindow && mainContainer) {
        overlay.classList.add('show');
        floatWindow.classList.add('show');
        mainContainer.classList.add('sink');
        
        // 更新浮窗中的歌曲信息
        updateMusicFloatInfo();
        
        // 更新播放/暂停按钮状态
        updatePlayPauseButton();
        
        // 更新音量滑块
        const volumeSlider = document.getElementById('music-float-volume-slider');
        if (volumeSlider) {
            volumeSlider.value = Math.round(settings.volume * 100);
        }
    }
}

function closeMusicFloat() {
    const overlay = document.getElementById('music-float-overlay');
    const floatWindow = document.getElementById('music-float');
    const mainContainer = document.querySelector('.main-container');
    
    if (overlay && floatWindow && mainContainer) {
        overlay.classList.remove('show');
        floatWindow.classList.remove('show');
        mainContainer.classList.remove('sink');
    }
}

// 音乐浮窗滚动控制
let musicFloatScrollInterval = null;

function updateMusicFloatInfo() {
    const songTitle = document.getElementById('music-float-song-title');
    const songInfo = document.getElementById('music-float-song-info');
    
    if (songTitle && songInfo) {
        if (currentPlayingSong) {
            songTitle.textContent = currentPlayingSong;
            songInfo.textContent = i18n('music.now_playing');
            
            // 停止之前的滚动
            stopMusicFloatScroll();
            
            // 检测歌曲名称是否过长，需要滚动
            setTimeout(() => {
                const container = songTitle.parentElement;
                if (songTitle.scrollWidth > container.clientWidth) {
                    startMusicFloatScroll(songTitle, container);
                }
            }, 100);
        } else {
            songTitle.textContent = i18n('music.no_music_playing');
            songInfo.textContent = '';
            stopMusicFloatScroll();
        }
    }
}

function startMusicFloatScroll(element, container) {
    // 重置位置
    element.style.transform = 'translateX(0)';
    
    let position = 0;
    const speed = 1;
    
    musicFloatScrollInterval = setInterval(() => {
        position -= speed;
        
        // 当元素完全滚动出容器时，重置位置
        if (position < -element.offsetWidth) {
            position = container.offsetWidth;
        }
        
        element.style.transform = `translateX(${position}px)`;
    }, 30);
}

function stopMusicFloatScroll() {
    if (musicFloatScrollInterval) {
        clearInterval(musicFloatScrollInterval);
        musicFloatScrollInterval = null;
    }
    
    const songTitle = document.getElementById('music-float-song-title');
    if (songTitle) {
        songTitle.style.transform = 'translateX(0)';
    }
}

function updatePlayPauseButton() {
    const button = document.getElementById('music-float-play-pause');
    const icon = document.getElementById('music-float-play-pause-icon');
    
    if (button && icon) {
        if (audioPlayer && !audioPlayer.paused) {
            // 正在播放，显示暂停图标
            icon.src = '../assets/icon/pause-solid-full.svg';
            icon.alt = 'Pause';
        } else {
            // 已暂停，显示播放图标
            icon.src = '../assets/icon/play-solid-full.svg';
            icon.alt = 'Play';
        }
    }
}

async function togglePlayPause() {
    if (!audioPlayer) {
        // 如果没有音频播放器，尝试播放音乐
        await window.simpmcAPI.requestPlayMusic();
        return;
    }
    
    if (audioPlayer.paused) {
        // 播放
        try {
            await audioPlayer.play();
        } catch (error) {
            console.error('[Music] Play error:', error);
        }
    } else {
        // 暂停
        audioPlayer.pause();
    }
    
    // 更新按钮状态
    updatePlayPauseButton();
}

// 监听键盘快捷键
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ctrl+M 打开音乐浮窗
        if (event.ctrlKey && event.key === 'm') {
            event.preventDefault();
            openMusicFloat();
        }
    });
    
    // 点击遮罩层关闭浮窗
    const overlay = document.getElementById('music-float-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeMusicFloat);
    }
    
    // 防止浮窗内点击事件冒泡到遮罩层
    const floatWindow = document.getElementById('music-float');
    if (floatWindow) {
        floatWindow.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
}

// 初始化音乐浮窗
function initMusicFloat() {
    setupKeyboardShortcuts();
    
    // 监听音频状态变化
    if (audioPlayer) {
        audioPlayer.addEventListener('play', updatePlayPauseButton);
        audioPlayer.addEventListener('pause', updatePlayPauseButton);
        audioPlayer.addEventListener('ended', updatePlayPauseButton);
    }
}

// 在应用初始化时设置音乐浮窗
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initMusicFloat);
}

async function loadProfilesForAssignment() {
    try {
        const data = await window.simpmcAPI.getProfiles();
        const profiles = data.profiles || [];
        const select = document.getElementById('profile-select');
        if (!select) return;
        select.innerHTML = `<option value="">${i18n('wardrobe.select_profile') || '选择档案'}</option>`;
        profiles.forEach(p => {
            const selected = currentSkinData && p.skinId === currentSkinData.id ? 'selected' : '';
            select.innerHTML += `<option value="${p.id}" ${selected}>${p.name}</option>`;
        });
    } catch (error) {
        console.error('Failed to load profiles:', error);
    }
}

async function assignSkinToProfile() {
    const select = document.getElementById('profile-select');
    const profileId = select.value;
    if (!profileId) return;

    try {
        const data = await window.simpmcAPI.getProfiles();
        const profiles = data.profiles || [];
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            profile.skinId = currentSkinData.id;
            await window.simpmcAPI.updateProfile(profile);
            alert(i18n('wardrobe.assign_success') || '已成功指派皮肤');
        }
    } catch (error) {
        console.error('Failed to assign skin:', error);
    }
}

async function saveSkinName() {
    const nameInput = document.getElementById('skin-name-input');
    const newName = nameInput.value.trim();
    if (!newName || !currentSkinData) return;

    try {
        await window.simpmcAPI.updateWardrobeItem({
            id: currentSkinData.id,
            name: newName,
            type: currentSkinData.type
        });
        currentSkinData.name = newName;
        window.skinPreviewData = currentSkinData;
        await loadWardrobe();
    } catch (error) {
        console.error('Failed to save skin name:', error);
    }
}

function editProfile(profileId) {
    const profile = cachedProfiles.find(p => p.id === profileId);
    if (profile) {
        window.simpmcAPI.openCharacterWindow('offline', profile);
    }
}

function launchProfile(profileId) {
    console.log('Launch profile:', profileId);
}

async function deleteProfile(profileId) {
    try {
        await window.simpmcAPI.deleteProfile(profileId);
        await loadProfiles();
    } catch (error) {
        console.error('Failed to delete profile:', error);
    }
}

async function selectLanguage(locale) {
    try {
        await window.simpmcAPI.setAppLocale(locale);
        currentLangData = null;
        await applyTranslations();
        
        document.querySelectorAll('.language-card-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById(`card-${locale}`)?.classList.add('active');
    } catch (error) {
        console.error('Failed to change language:', error);
    }
}

function showOnboardingAgain() {
    window.simpmcAPI.resetOnboarding();
    document.getElementById('onboarding-container').style.display = 'block';
    document.getElementById('page-content').style.display = 'none';
    document.getElementById('menu-container').style.display = 'none';
    showOnboardingStep(1);
    setupLanguageCards();
    setupCharacterCards();
}

// Download page functionality
let versionsData = null;
let selectedVersion = null;
let currentVersionType = 'release';
let isDownloading = false;
let downloadStartTime = null;
let lastProgressData = null;

async function loadDownloadPage() {
    await loadInstallPath();
    await loadDownloadSource();
    await loadVersions();
    
    window.simpmcAPI.onDownloadProgress((data) => {
        handleDownloadProgress(data);
    });
}

async function loadDownloadSource() {
    try {
        const source = await window.simpmcAPI.getDownloadSource();
        updateDownloadSourceUI(source);
    } catch (error) {
        console.error('Failed to load download source:', error);
    }
}

function updateDownloadSourceUI(source) {
    document.querySelectorAll('.source-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === source);
    });
}

async function switchDownloadSource(source) {
    try {
        await window.simpmcAPI.setDownloadSource(source);
        updateDownloadSourceUI(source);
        await loadVersions();
    } catch (error) {
        console.error('Failed to switch download source:', error);
    }
}

async function loadInstallPath() {
    try {
        const path = await window.simpmcAPI.getInstallPath();
        const input = document.getElementById('install-path-input');
        if (input) {
            input.value = path;
        }
    } catch (error) {
        console.error('Failed to load install path:', error);
    }
}

async function selectInstallPath() {
    try {
        const path = await window.simpmcAPI.selectInstallDirectory();
        if (path) {
            await window.simpmcAPI.setInstallPath(path);
            const input = document.getElementById('install-path-input');
            if (input) {
                input.value = path;
            }
        }
    } catch (error) {
        console.error('Failed to select install path:', error);
    }
}

async function loadVersions() {
    const versionList = document.getElementById('version-list');
    if (!versionList) return;
    
    versionList.innerHTML = `
        <div class="loading-state" id="version-loading">
            <div class="loading-spinner"></div>
            <span data-i18n="download.loading_versions"></span>
        </div>
    `;
    applyTranslations();
    
    try {
        const result = await window.simpmcAPI.getMinecraftVersions();
        if (result.success) {
            versionsData = result;
            renderVersions();
        } else {
            versionList.innerHTML = `
                <div class="loading-state">
                    <span>${result.error || 'Failed to load versions'}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load versions:', error);
        versionList.innerHTML = `
            <div class="loading-state">
                <span>Failed to load versions</span>
            </div>
        `;
    }
}

function switchVersionType(type) {
    currentVersionType = type;
    document.querySelectorAll('.version-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    renderVersions();
}

function isAprilFoolsVersion(version) {
    if (version.type === 'release') return false;
    const releaseDate = new Date(version.releaseTime);
    return releaseDate.getMonth() === 3 && releaseDate.getDate() === 1;
}

function renderVersions() {
    const versionList = document.getElementById('version-list');
    if (!versionList || !versionsData) return;
    
    let filteredVersions;
    
    if (currentVersionType === 'april-fools') {
        filteredVersions = versionsData.versions.filter(v => isAprilFoolsVersion(v));
    } else {
        filteredVersions = versionsData.versions.filter(v => v.type === currentVersionType && !isAprilFoolsVersion(v));
    }
    
    if (filteredVersions.length === 0) {
        versionList.innerHTML = `
            <div class="loading-state">
                <span data-i18n="download.no_versions"></span>
            </div>
        `;
        applyTranslations();
        return;
    }
    
    versionList.innerHTML = filteredVersions.map(version => {
        const isSelected = selectedVersion && selectedVersion.id === version.id;
        const releaseDate = new Date(version.releaseTime).toLocaleDateString();
        const tagText = currentVersionType === 'april-fools' ? '🎭 愚人节' : version.type;
        const tagClass = currentVersionType === 'april-fools' ? 'version-type-tag april-fools' : 'version-type-tag';
        
        return `
            <div class="version-item ${isSelected ? 'selected' : ''}" onclick="selectVersion('${version.id}')">
                <div>
                    <div class="version-name">${version.id}</div>
                    <div class="version-date">${releaseDate}</div>
                </div>
                <div class="${tagClass}">${tagText}</div>
            </div>
        `;
    }).join('');
}

async function selectVersion(versionId) {
    if (!versionsData) return;
    
    const version = versionsData.versions.find(v => v.id === versionId);
    if (!version) return;
    
    selectedVersion = version;
    renderVersions();
    showVersionInfo();
    
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.disabled = false;
    }
}

async function showVersionInfo() {
    const section = document.getElementById('version-info-section');
    if (!section || !selectedVersion) return;
    
    section.classList.remove('hidden');
    
    document.getElementById('version-info-name').textContent = selectedVersion.id;
    document.getElementById('version-info-type').textContent = selectedVersion.type;
    document.getElementById('version-info-date').textContent = new Date(selectedVersion.releaseTime).toLocaleDateString();
    document.getElementById('version-info-size').textContent = '-';
}

async function startDownload() {
    if (!selectedVersion || isDownloading) return;
    
    isDownloading = true;
    downloadStartTime = Date.now();
    
    updateDownloadUI('downloading');
    
    try {
        const isolateCheckbox = document.getElementById('isolate-version');
        const options = {
            isolate: isolateCheckbox ? isolateCheckbox.checked : true
        };
        const result = await window.simpmcAPI.startDownload(selectedVersion.id, options);
        
        if (result.success) {
            updateDownloadUI('complete');
        } else {
            updateDownloadUI('error');
            alert(i18n('download.error') + ': ' + result.error);
        }
    } catch (error) {
        console.error('Download failed:', error);
        updateDownloadUI('error');
        alert(i18n('download.error') + ': ' + error.message);
    } finally {
        isDownloading = false;
    }
}

function pauseDownload() {
    window.simpmcAPI.pauseDownload();
    updateDownloadUI('paused');
}

function resumeDownload() {
    window.simpmcAPI.resumeDownload();
    updateDownloadUI('downloading');
}

function cancelDownload() {
    if (confirm(i18n('download.confirm_cancel'))) {
        window.simpmcAPI.cancelDownload();
        updateDownloadUI('idle');
        isDownloading = false;
    }
}

function handleDownloadProgress(data) {
    lastProgressData = data;
    
    const overallProgressBar = document.getElementById('overall-progress-bar');
    const overallProgressDownloaded = document.getElementById('overall-progress-downloaded');
    const overallProgressTotal = document.getElementById('overall-progress-total');
    const overallProgressCompleted = document.getElementById('overall-progress-completed');
    const progressStatus = document.getElementById('progress-status');
    const filesProgressSection = document.getElementById('files-progress-section');
    
    if (data.type === 'overall') {
        // 更新总进度
        if (overallProgressBar && data.progress !== undefined) {
            overallProgressBar.style.width = `${Math.min(data.progress, 100)}%`;
        }
        
        if (overallProgressDownloaded && data.downloaded !== undefined) {
            overallProgressDownloaded.textContent = formatBytes(data.downloaded);
        }
        
        if (overallProgressTotal && data.total !== undefined) {
            overallProgressTotal.textContent = formatBytes(data.total);
        }
        
        if (overallProgressCompleted && data.completed !== undefined && data.totalFiles !== undefined) {
            overallProgressCompleted.textContent = `${data.completed}/${data.totalFiles} 文件`;
        }
        
        // 更新单个文件进度
        if (filesProgressSection && data.files) {
            updateFilesProgress(data.files);
        }
    } else if (data.type === 'complete') {
        if (progressStatus) {
            progressStatus.textContent = i18n('download.complete');
        }
        updateDownloadUI('complete');
        isDownloading = false;
    } else if (data.status === 'complete') {
        if (progressStatus) {
            progressStatus.textContent = i18n('download.complete');
        }
        updateDownloadUI('complete');
        isDownloading = false;
    } else if (data.message) {
        if (progressStatus) {
            progressStatus.textContent = data.message;
        }
    }
}

function updateFilesProgress(files) {
    const filesProgressSection = document.getElementById('files-progress-section');
    if (!filesProgressSection) return;
    
    // 只显示正在下载或最近完成的文件
    const activeFiles = files.filter(f => 
        f.status === 'downloading' || f.status === 'verifying' || f.status === 'error'
    );
    
    // 加上最近完成的10个
    const completedFiles = files.filter(f => f.status === 'completed').slice(-10);
    const displayFiles = [...activeFiles, ...completedFiles];
    
    // 清空并重新渲染
    filesProgressSection.innerHTML = '';
    
    displayFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-progress-item';
        fileItem.innerHTML = `
            <div class="file-progress-header">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-status ${file.status}">${getFileStatusText(file.status)}</div>
            </div>
            <div class="file-progress-bar-bg">
                <div class="file-progress-bar" style="width: ${file.progress || 0}%"></div>
            </div>
            <div class="file-progress-info">
                <span>${formatBytes(file.downloaded || 0)}</span>
                <span>${formatBytes(file.total || 0)}</span>
            </div>
        `;
        filesProgressSection.appendChild(fileItem);
    });
    
    // 自动滚动到顶部
    filesProgressSection.scrollTop = 0;
}

function getFileStatusText(status) {
    const statusMap = {
        'pending': '等待中',
        'downloading': '下载中',
        'verifying': '校验中',
        'completed': '已完成',
        'error': '错误'
    };
    return statusMap[status] || status;
}

function updateDownloadUI(state) {
    const downloadBtn = document.getElementById('download-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const progressContainer = document.getElementById('progress-container');
    
    if (!downloadBtn) return;
    
    if (state === 'idle') {
        downloadBtn.style.display = 'block';
        pauseBtn?.classList.add('hidden');
        resumeBtn?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        progressContainer?.classList.add('hidden');
        downloadBtn.disabled = !selectedVersion;
    } else if (state === 'downloading') {
        downloadBtn.style.display = 'none';
        pauseBtn?.classList.remove('hidden');
        resumeBtn?.classList.add('hidden');
        cancelBtn?.classList.remove('hidden');
        progressContainer?.classList.remove('hidden');
    } else if (state === 'paused') {
        downloadBtn.style.display = 'none';
        pauseBtn?.classList.add('hidden');
        resumeBtn?.classList.remove('hidden');
        cancelBtn?.classList.remove('hidden');
    } else if (state === 'complete' || state === 'error') {
        downloadBtn.style.display = 'block';
        pauseBtn?.classList.add('hidden');
        resumeBtn?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        downloadBtn.disabled = !selectedVersion;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

window.addEventListener('DOMContentLoaded', initApp);

document.addEventListener('wheel', async function(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        
        // 获取当前音量：先尝试从 store 获取，如果失败则使用滑块值
        let currentVolume = 50;
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            currentVolume = parseInt(volumeSlider.value) || 50;
        } else {
            // 不在个性化页面时，从 store 获取当前音量
            try {
                const musicSettings = await window.simpmcAPI.getMusicSettings();
                currentVolume = Math.round(musicSettings.volume * 100);
            } catch (error) {
                console.error('Failed to get music settings:', error);
            }
        }
        
        const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
        
        // 无论是否在个性化页面，都调节音量并显示指示器
        setMusicVolume(newVolume);
        
        // 如果在个性化页面，更新滑块值
        if (volumeSlider) {
            volumeSlider.value = newVolume;
        }
    }
}, { passive: false });

function showConfirmModal(title, content, color = 'blue') {
    let overlay = document.getElementById('confirm-modal-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="confirm-modal-title"></h3>
                </div>
                <div class="modal-body">
                    <p class="modal-text" id="confirm-modal-text"></p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn" id="confirm-modal-btn" onclick="closeConfirmModal()"></button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeConfirmModal();
            }
        });
    }
    
    const titleEl = document.getElementById('confirm-modal-title');
    const textEl = document.getElementById('confirm-modal-text');
    const btnEl = document.getElementById('confirm-modal-btn');
    
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = content;
    
    if (btnEl) {
        btnEl.textContent = i18n('common.confirm') || '确认';
        btnEl.className = 'modal-btn modal-btn-' + color;
    }
    
    if (overlay) {
        overlay.classList.add('show');
    }
}

function closeConfirmModal() {
    const overlay = document.getElementById('confirm-modal-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

let selectedProfileId = null;
let recentProfileIds = [];

async function loadProfilesForHomePage() {
    try {
        const data = await window.simpmcAPI.getProfiles();
        cachedProfiles = data.profiles || [];
        recentProfileIds = data.recentProfileIds || [];

        try {
            const wardrobeData = await window.simpmcAPI.getWardrobe();
            cachedWardrobe = wardrobeData;
        } catch (error) {
            console.error('Failed to load wardrobe:', error);
            cachedWardrobe = { skins: [], capes: [] };
        }

        renderProfileSelector();
    } catch (error) {
        console.error('Failed to load profiles:', error);
        cachedProfiles = [];
    }
}

function getSkinPreviewUrl(skinId) {
    if (!skinId) return '';

    if (skinId === 'steve' || skinId === 'alex') {
        return `../assets/icon/${skinId}.png`;
    }

    const allSkins = (cachedWardrobe && cachedWardrobe.skins) || [];
    const skin = allSkins.find(s => s.id === skinId);
    if (skin && skin.filePath) {
        return `file:///${skin.filePath.replace(/\\/g, '/')}`;
    }

    return '';
}

function getProfileTypeLabel(type) {
    const labels = {
        'offline': i18n('auth.offline_character') || '离线',
        'microsoft': i18n('auth.official_character') || '正版',
        'third_party': i18n('auth.third_party_character') || '第三方'
    };
    return labels[type] || type || '未知';
}

function getProfileTypeClass(type) {
    const classes = {
        'offline': 'type-offline',
        'microsoft': 'type-microsoft',
        'third_party': 'type-third-party'
    };
    return classes[type] || 'type-unknown';
}

function renderProfileSelector() {
    const menu = document.getElementById('profile-dropdown-menu');
    const currentSkin = document.getElementById('current-profile-skin');
    const currentName = document.getElementById('current-profile-name');

    if (!menu) return;

    if (cachedProfiles.length === 0) {
        const createText = i18n('home.create_profile') || '请新建档案';
        menu.innerHTML = `<div class="profile-dropdown-item" onclick="switchPage('wardrobe')">
            <span class="profile-dropdown-item-name">${createText}</span>
        </div>`;
        if (currentName) currentName.textContent = createText;
        if (currentSkin) currentSkin.style.backgroundImage = '';
        selectedProfileId = null;
        return;
    }

    if (!selectedProfileId && cachedProfiles.length > 0) {
        selectedProfileId = cachedProfiles[0].id;
    }

    if (!recentProfileIds.includes(selectedProfileId)) {
        recentProfileIds = [selectedProfileId, ...recentProfileIds.filter(id => id !== selectedProfileId)].slice(0, 3);
    }

    const selectedProfile = cachedProfiles.find(p => p.id === selectedProfileId);

    if (currentName) currentName.textContent = selectedProfile ? selectedProfile.name : '-';
    if (currentSkin) {
        const skinUrl = selectedProfile ? getSkinPreviewUrl(selectedProfile.skinId) : '';
        if (skinUrl) {
            currentSkin.style.backgroundImage = `url('${skinUrl}')`;
        } else {
            currentSkin.style.backgroundImage = '';
        }
    }

    const MAX_RECENT = 3;
    const recentProfiles = recentProfileIds
        .map(id => cachedProfiles.find(p => p.id === id))
        .filter(p => p);

    const otherProfiles = cachedProfiles.filter(p => !recentProfileIds.includes(p.id));

    let html = '';

    if (recentProfiles.length > 0) {
        html += recentProfiles.map(profile => {
            const isSelected = profile.id === selectedProfileId;
            const skinUrl = getSkinPreviewUrl(profile.skinId);
            return `
                <div class="profile-dropdown-item ${isSelected ? 'selected' : ''}"
                     onclick="selectProfile('${profile.id}', '${profile.name.replace(/'/g, "\\'")}', '${skinUrl}')">
                    <div class="profile-dropdown-item-skin" style="${skinUrl ? `background-image: url('${skinUrl}')` : ''}"></div>
                    <span class="profile-dropdown-item-name">${profile.name}</span>
                    <span class="profile-type-badge ${getProfileTypeClass(profile.type)}">${getProfileTypeLabel(profile.type)}</span>
                </div>
            `;
        }).join('');
    }

    if (otherProfiles.length > 0) {
        html += `
            <div class="profile-dropdown-item profile-more-item" onclick="openAllProfilesModal()">
                <span class="profile-dropdown-item-name">${i18n('home.more_profiles') || '更多...'}</span>
            </div>
        `;
    }

    menu.innerHTML = html;
}

let currentProfileFilter = 'all';

function openAllProfilesModal() {
    const modal = document.getElementById('all-profiles-modal');
    if (modal) {
        currentProfileFilter = 'all';
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === 'all');
        });
        document.getElementById('profile-search-input').value = '';
        renderAllProfilesList();
        modal.classList.add('show');
    }
}

function closeAllProfilesModal() {
    const modal = document.getElementById('all-profiles-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function filterProfilesByType(type) {
    currentProfileFilter = type;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });
    renderAllProfilesList();
}

function filterProfiles() {
    renderAllProfilesList();
}

function renderAllProfilesList() {
    const list = document.getElementById('all-profiles-list');
    if (!list) return;

    const searchText = (document.getElementById('profile-search-input')?.value || '').toLowerCase();

    const filtered = cachedProfiles.filter(p => {
        const matchesType = currentProfileFilter === 'all' || p.type === currentProfileFilter;
        const matchesSearch = !searchText || p.name.toLowerCase().includes(searchText);
        return matchesType && matchesSearch;
    });

    list.innerHTML = filtered.map(profile => {
        const isSelected = profile.id === selectedProfileId;
        const skinUrl = getSkinPreviewUrl(profile.skinId);
        const typeLabel = getProfileTypeLabel(profile.type);
        return `
            <div class="all-profile-item ${isSelected ? 'selected' : ''}"
                 onclick="selectProfile('${profile.id}', '${profile.name.replace(/'/g, "\\'")}', '${skinUrl}'); closeAllProfilesModal();">
                <div class="all-profile-item-skin" style="${skinUrl ? `background-image: url('${skinUrl}')` : ''}"></div>
                <div class="all-profile-item-info">
                    <div class="all-profile-item-name">${profile.name}</div>
                    <div class="all-profile-item-type">${typeLabel}</div>
                </div>
            </div>
        `;
    }).join('');
}

function selectProfile(profileId, profileName, skinUrl) {
    selectedProfileId = profileId;
    recentProfileIds = [profileId, ...recentProfileIds.filter(id => id !== profileId)].slice(0, 5);
    window.simpmcAPI.setRecentProfiles(recentProfileIds);

    const currentName = document.getElementById('current-profile-name');
    const currentSkin = document.getElementById('current-profile-skin');

    if (currentName) currentName.textContent = profileName;
    if (currentSkin) {
        if (skinUrl) {
            currentSkin.style.backgroundImage = `url('${skinUrl}')`;
        } else {
            currentSkin.style.backgroundImage = '';
        }
    }

    document.querySelectorAll('.profile-dropdown-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');

    renderProfileSelector();
    toggleProfileDropdown();
}

function toggleProfileDropdown() {
    const menu = document.getElementById('profile-dropdown-menu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

document.addEventListener('click', function(e) {
    const selector = document.getElementById('profile-selector-container');
    const menu = document.getElementById('profile-dropdown-menu');
    if (selector && menu && !selector.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
    }
});

function updateLaunchButton() {
    const launchBtn = document.getElementById('launch-game-btn');
    if (launchBtn) {
        const text = i18n('home.launch');
        if (text && text !== 'home.launch') {
            launchBtn.textContent = text;
        }
    }
}