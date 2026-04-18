function showTranslationErrorModal(callback) {
    const modal = document.createElement('div');
    modal.id = 'translation-error-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    
    modal.innerHTML = `
        <div style="
            background: rgba(40, 40, 40, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        ">
            <h3 style="margin: 0 0 15px 0; color: #1976D2;">翻译文件缺失</h3>
            <p style="margin: 0 0 25px 0; color: rgba(255, 255, 255, 0.8); line-height: 1.5;">
                语言文件损坏或缺失，<br>点击确定后将切换至「中文（简体）」<br>仅在本次生效。
            </p>
            <button id="translation-error-confirm" style="
                padding: 12px 30px;
                background: #1976D2;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.3s;
            ">确定</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('translation-error-confirm').addEventListener('click', function() {
        modal.remove();
        if (callback) callback();
    });
}

async function applyTranslations() {
    try {
        const locale = await window.simpmcAPI.getUserLocale();
        console.log("检测到的用户语言：", locale);
        const appLocale = await window.simpmcAPI.getAppLocale();
        console.log("配置的应用语言：", appLocale);
        
        const response = await fetch(`../locales/${appLocale || locale}.json`);
        if (!response.ok) {
            throw new Error('Language file not found');
        }
        
        const langData = await response.json();
        currentLangData = langData;

        const getDescendantProp = (obj, desc) => {
            const arr = desc.split(".");
            while (arr.length && (obj = obj[arr.shift()]));
            return obj;
        };

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = getDescendantProp(langData, key);
            if (translation) {
                if (el.tagName === 'INPUT' && el.type === 'radio') {
                    el.label.innerText = translation;
                } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = translation;
                } else {
                    el.innerText = translation;
                }
            } else {
                console.warn(`未找到翻译： ${key}`);
            }
        });

        console.log("翻译应用成功!");
    } catch (error) {
        console.error("翻译应用失败:", error);
        
        showTranslationErrorModal(async function() {
            await loadTranslationFile('zh-CN');
        });
    }
}

async function loadTranslationFile(locale) {
    try {
        const response = await fetch(`../locales/${locale}.json`);
        if (!response.ok) {
            throw new Error('Default language file not found');
        }
        
        const langData = await response.json();

        const getDescendantProp = (obj, desc) => {
            const arr = desc.split(".");
            while (arr.length && (obj = obj[arr.shift()]));
            return obj;
        };

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = getDescendantProp(langData, key);
            if (translation) {
                if (el.tagName === 'INPUT' && el.type === 'radio') {
                    el.label.innerText = translation;
                } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = translation;
                } else {
                    el.innerText = translation;
                }
            } else {
                console.warn(`未找到翻译： ${key}`);
            }
        });

        console.log("翻译应用成功!");
    } catch (error) {
        console.error("加载翻译文件失败:", error);
    }
}

function setWebAppLocale() {
    const locale = document.querySelector('input[name="language"]:checked').value;
    window.simpmcAPI.setAppLocale(locale);
    applyTranslations();
}

let currentLangData = null;

function i18n(key) {
    if (currentLangData) {
        const getDescendantProp = (obj, desc) => {
            const arr = desc.split(".");
            while (arr.length && (obj = obj[arr.shift()]));
            return obj;
        };
        return getDescendantProp(currentLangData, key) || key;
    }
    return key;
}
