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

        if (pageName === 'home') {
            updateGreeting();
            if (window.loadHomePage) {
                loadHomePage();
            }
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
        }
    } catch (error) {
        console.error('Error loading page:', error);
        if (pageContent) {
            pageContent.innerHTML = '<p>页面加载失败</p>';
        }
    }
}

// 下载设置相关函数
async function openDownloadSettingsModal() {
    const modal = document.getElementById('download-settings-modal');
    modal.classList.remove('hidden');
    
    try {
        const installPath = await window.simpmcAPI.getInstallPath();
        const downloadSource = await window.simpmcAPI.getDownloadSource();
        const settings = await window.simpmcAPI.getDownloadSettings();
        
        document.getElementById('install-path-input-settings').value = installPath;
        document.getElementById('download-source-select').value = downloadSource;
        document.getElementById('concurrent-downloads-select').value = settings.concurrentDownloads || 2;
        document.getElementById('max-retries-select').value = settings.maxRetries || 5;
    } catch (error) {
        console.error('Failed to load download settings:', error);
    }
}

function closeDownloadSettingsModal() {
    document.getElementById('download-settings-modal').classList.add('hidden');
}

async function selectInstallPathSettings() {
    try {
        const newPath = await window.simpmcAPI.selectInstallDirectory();
        if (newPath) {
            document.getElementById('install-path-input-settings').value = newPath;
        }
    } catch (error) {
        console.error('Failed to select install path:', error);
    }
}

async function saveDownloadSettings() {
    try {
        const installPath = document.getElementById('install-path-input-settings').value;
        const downloadSource = document.getElementById('download-source-select').value;
        const concurrentDownloads = parseInt(document.getElementById('concurrent-downloads-select').value);
        const maxRetries = parseInt(document.getElementById('max-retries-select').value);
        
        await window.simpmcAPI.setInstallPath(installPath);
        await window.simpmcAPI.setDownloadSource(downloadSource);
        await window.simpmcAPI.setDownloadSettings({
            concurrentDownloads,
            maxRetries
        });
        
        closeDownloadSettingsModal();
    } catch (error) {
        console.error('Failed to save download settings:', error);
        alert('保存设置失败：' + error.message);
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

async function openDisplayNameModal() {
    const modal = document.getElementById('display-name-modal');
    const input = document.getElementById('display-name-input');
    if (!modal || !input) return;
    
    const currentName = await window.simpmcAPI.getDisplayName();
    const systemUsername = await window.simpmcAPI.getSystemUsername();
    input.value = currentName || systemUsername || '';
    
    modal.classList.remove('hidden');
}

function closeDisplayNameModal() {
    document.getElementById('display-name-modal').classList.add('hidden');
}

async function saveDisplayName() {
    const input = document.getElementById('display-name-input');
    if (!input) return;
    
    const name = input.value.trim();
    await window.simpmcAPI.setDisplayName(name || null);
    closeDisplayNameModal();
    
    if (currentPage === 'home') {
        updateGreeting();
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