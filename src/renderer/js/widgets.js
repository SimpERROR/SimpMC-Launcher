const WIDGET_TEMPLATES_URL = 'https://raw.githubusercontent.com/SimpERROR/SimpMC-Launcher/refs/heads/main/SimpMC_Assets/widgets.json';
let WIDGET_TEMPLATES = {};
let externalWidgets = {};
let widgetIntervals = {};

window.WIDGET_TEMPLATES = WIDGET_TEMPLATES;
window.externalWidgets = externalWidgets;
window.loadWidgetTemplates = loadWidgetTemplates;

async function loadWidgetTemplates() {
    try {
        const response = await fetch(WIDGET_TEMPLATES_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data.widgets && Array.isArray(data.widgets)) {
            WIDGET_TEMPLATES = {};
            data.widgets.forEach(template => {
                if (template.type) {
                    template.source = 'official';
                    WIDGET_TEMPLATES[template.type] = template;
                }
            });
            window.WIDGET_TEMPLATES = WIDGET_TEMPLATES;
        }
    } catch (error) {
        console.error('加载官方小组件模板失败:', error);
        WIDGET_TEMPLATES = {};
        window.WIDGET_TEMPLATES = WIDGET_TEMPLATES;
    }
}

function checkForUpdates() {
    const updates = [];
    Object.values(WIDGET_TEMPLATES).forEach(template => {
        const installed = installedWidgets.find(w => w.type === template.type);
        if (installed && installed.version && template.version) {
            if (compareVersions(template.version, installed.version) > 0) {
                updates.push({
                    type: template.type,
                    name: template.name,
                    oldVersion: installed.version,
                    newVersion: template.version
                });
            }
        }
    });
    if (updates.length > 0) {
        showUpdateNotification(updates);
    }
}

function compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

function showUpdateNotification(updates) {
    const names = updates.map(u => `"${u.name}" (${u.oldVersion} → ${u.newVersion})`).join('\n');
    const message = i18n('widgets.update_available_message').replace('{list}', names);
    showConfirmModal(
        i18n('widgets.update_available'),
        message,
        async () => {
            const updatesApplied = [];
            updates.forEach(update => {
                const widget = installedWidgets.find(w => w.type === update.type);
                const template = WIDGET_TEMPLATES[update.type];
                if (widget && template) {
                    const preservedConfig = widget.config || {};
                    widget.name = template.name;
                    widget.size = template.size;
                    widget.desc = template.desc;
                    widget.category = template.category;
                    widget.version = template.version;
                    widget.template = { ...template };
                    widget.source = template.source || 'official';
                    widget.sourceUrl = template.sourceUrl;
                    widget.config = preservedConfig;
                    updatesApplied.push(widget.type);
                }
            });

            if (updatesApplied.length > 0) {
                await window.simpmcAPI.saveWidgets(installedWidgets);
                showToast(i18n('widgets.update_success'), 'success');
                renderInstalledWidgets();
            }
        }
    );
}

async function loadExternalWidget(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        if (data.widgets && Array.isArray(data.widgets)) {
            const external = {};
            data.widgets.forEach(template => {
                if (template.type) {
                    template.source = 'external';
                    template.sourceUrl = url;
                    external[template.type] = template;
                }
            });
            return external;
        }
        return null;
    } catch (error) {
        console.error('加载外部小组件失败:', error);
        return null;
    }
}

let installedWidgets = [];
let draggedWidgetEl = null;
let confirmCallback = null;
let externalImportCallback = null;
let widgetStylesInjected = new Set();
let configWidgetCallback = null;

function injectWidgetStyles(template) {
    if (!template || !template.styles || widgetStylesInjected.has(template.type)) return;
    
    let styleEl = document.getElementById('widget-styles-' + template.type);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'widget-styles-' + template.type;
        styleEl.textContent = template.styles;
        document.head.appendChild(styleEl);
        widgetStylesInjected.add(template.type);
    }
}

function clearWidgetStyles(type) {
    const styleEl = document.getElementById('widget-styles-' + type);
    if (styleEl) {
        styleEl.remove();
        widgetStylesInjected.delete(type);
    }
}

function showWidgetConfigModal(widgetId) {
    const widget = installedWidgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    const template = getTemplate(widget);
    if (!template || !template.config || template.config.length === 0) {
        showToast(i18n('widgets.no_config_support'), 'info');
        return;
    }
    
    const modal = document.getElementById('widget-config-modal');
    const titleEl = document.getElementById('widget-config-title');
    const formEl = document.getElementById('widget-config-form');
    if (!modal || !titleEl || !formEl) return;
    
    titleEl.textContent = `${i18n('widgets.config')} ${widget.name}`;
    
    formEl.innerHTML = template.config.map(field => {
        const value = widget.config?.[field.key] ?? field.default;
        let inputHtml = '';
        
        switch (field.type) {
            case 'text':
                inputHtml = `<input type="text" name="${field.key}" value="${escapeHtml(String(value))}" />`;
                break;
            case 'number':
                inputHtml = `<input type="number" name="${field.key}" value="${value}" />`;
                break;
            case 'color':
                inputHtml = `<input type="color" name="${field.key}" value="${value}" />`;
                break;
            case 'checkbox':
                inputHtml = `<input type="checkbox" name="${field.key}" ${value ? 'checked' : ''} />`;
                break;
            case 'select':
                inputHtml = `<select name="${field.key}">${(field.options || []).map(opt => 
                    `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`
                ).join('')}</select>`;
                break;
            default:
                inputHtml = `<input type="text" name="${field.key}" value="${escapeHtml(String(value))}" />`;
        }
        
        return `
            <div class="config-field">
                <label for="config-${field.key}">${field.label}</label>
                ${inputHtml}
            </div>
        `;
    }).join('');
    
    modal.classList.add('show');
    
    configWidgetCallback = async () => {
        const formData = new FormData(formEl);
        const newConfig = {};
        
        template.config.forEach(field => {
            if (field.type === 'checkbox') {
                newConfig[field.key] = formEl.querySelector(`[name="${field.key}"]`)?.checked ?? field.default;
            } else {
                newConfig[field.key] = formEl.querySelector(`[name="${field.key}"]`)?.value ?? field.default;
            }
        });
        
        widget.config = newConfig;
        
        try {
            await window.simpmcAPI.saveWidgets(installedWidgets);
            renderInstalledWidgets();
            showToast(i18n('widgets.save_success'), 'success');
        } catch (error) {
            console.error('保存配置失败:', error);
            showToast(i18n('widgets.save_failed'), 'error');
        }
        
        closeWidgetConfigModal();
    };
}

function closeWidgetConfigModal() {
    const modal = document.getElementById('widget-config-modal');
    if (modal) modal.classList.remove('show');
    configWidgetCallback = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('show');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    if (!modal || !titleEl || !messageEl) return;
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.add('show');
    confirmCallback = onConfirm;
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('show');
    confirmCallback = null;
}

function showExternalImportModal() {
    const modal = document.getElementById('external-import-modal');
    if (!modal) return;
    modal.classList.add('show');
}

function closeExternalImportModal() {
    const modal = document.getElementById('external-import-modal');
    const input = document.getElementById('external-widget-url');
    if (modal) modal.classList.remove('show');
    if (input) input.value = '';
    externalImportCallback = null;
}

function showSecurityWarningModal(widgetData, onConfirm) {
    const modal = document.getElementById('security-warning-modal');
    const list = document.getElementById('security-warning-list');
    if (!modal || !list) return;

    const risks = i18n('widgets.security_warning_risks');

    list.innerHTML = risks.map(risk => `<li>${risk}</li>`).join('');
    modal.classList.add('show');
    externalImportCallback = onConfirm;
}

function closeSecurityWarningModal() {
    const modal = document.getElementById('security-warning-modal');
    if (modal) modal.classList.remove('show');
    externalImportCallback = null;
}

async function loadWidgetsPage() {
    showLoading();
    try {
        await loadWidgetTemplates();
        const data = await window.simpmcAPI.getWidgets();
        installedWidgets = data.widgets || [];
        window.widgets = installedWidgets;
        renderInstalledWidgets();
        renderStoreWidgets();
        checkForUpdates();
    } catch (error) {
        console.error('加载小组件失败:', error);
        showToast(i18n('widgets.load_failed'), 'error');
    } finally {
        hideLoading();
    }
}

function getTemplate(widget) {
    return widget.template || WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type] || null;
}

function renderInstalledWidgets() {
    const grid = document.getElementById('installed-widgets-grid');
    if (!grid) return;

    if (installedWidgets.length === 0) {
        grid.innerHTML = `
            <div class="empty-installed">
                <div class="empty-installed-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <p class="empty-installed-text">${i18n('widgets.no_installed_widgets')}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = installedWidgets.map((widget) => {
        const template = getTemplate(widget);
        const source = template?.source || 'unknown';
        const isExternal = source === 'external';
        return `
            <div class="installed-widget-card" data-widget-id="${widget.id}" draggable="true">
                <div class="installed-widget-header">
                    <div class="installed-widget-info">
                        <div class="installed-widget-name">
                            ${widget.name}
                            <span class="widget-source-badge ${isExternal ? 'external' : 'official'}">
                                ${isExternal ? i18n('widgets.external') : i18n('widgets.official')}
                            </span>
                            <span class="widget-type-badge ${widget.enabled ? 'enabled' : 'disabled'}">
                                ${widget.enabled ? i18n('widgets.enabled') : i18n('widgets.disabled')}
                            </span>
                        </div>
                        <div class="installed-widget-size">
                            <span class="size-badge">${widget.size}</span>
                            <span>${template?.desc || ''}</span>
                        </div>
                    </div>
                    <div class="installed-widget-actions">
                        <button class="widget-action-btn move" title="${i18n('widgets.drag_hint')}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="5" r="2"></circle>
                                <circle cx="15" cy="5" r="2"></circle>
                                <circle cx="9" cy="12" r="2"></circle>
                                <circle cx="15" cy="12" r="2"></circle>
                                <circle cx="9" cy="19" r="2"></circle>
                                <circle cx="15" cy="19" r="2"></circle>
                            </svg>
                        </button>
                        ${template?.config?.length > 0 ? `
                        <button class="widget-action-btn config widget-config-btn" data-widget-id="${widget.id}" title="${i18n('widgets.config')}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                        ` : ''}
                        <button class="widget-action-btn widget-toggle-btn" data-widget-id="${widget.id}" title="${widget.enabled ? i18n('widgets.disabled') : i18n('widgets.enabled')}">
                            ${widget.enabled ?
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' :
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
                            }
                        </button>
                        <button class="widget-action-btn delete widget-remove-btn" data-widget-id="${widget.id}" title="${i18n('widgets.remove')}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="installed-widget-preview">
                    ${template?.desc || i18n('widgets.preview_area')}
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.widget-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleWidgetInstalled(btn.dataset.widgetId));
    });
    document.querySelectorAll('.widget-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => confirmRemoveWidget(btn.dataset.widgetId));
    });
    document.querySelectorAll('.widget-config-btn').forEach(btn => {
        btn.addEventListener('click', () => showWidgetConfigModal(btn.dataset.widgetId));
    });

    initInstalledWidgetDrag();
}

function renderStoreWidgets() {
    const grid = document.getElementById('store-widgets-grid');
    if (!grid) return;
    const installedTypes = installedWidgets.map(w => w.type);

    if (Object.keys(WIDGET_TEMPLATES).length === 0) {
        grid.innerHTML = `
            <div class="empty-installed">
                <div class="empty-installed-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <p class="empty-installed-text">${i18n('widgets.store_load_failed')}</p>
            </div>
        `;
        return;
    }

    const officialWidgets = Object.entries(WIDGET_TEMPLATES).filter(([type]) =>
        !installedTypes.includes(type)
    );

    let html = '';

    if (officialWidgets.length > 0) {
        html += officialWidgets.map(([type, template]) => {
            injectWidgetStyles(template);
            return `
            <div class="store-widget-card" data-widget-type="${type}">
                <div class="store-widget-header">
                    <span class="store-widget-name">${template.name}</span>
                    <span class="store-widget-badge">${template.size}</span>
                </div>
                <p class="store-widget-desc">${template.desc || ''}</p>
                <div class="store-widget-meta">
                    <span>${i18n('widgets.category_label')}: ${template.category || 'other'}</span>
                    <button class="store-widget-add-btn" data-widget-type="${type}">${i18n('widgets.add')}</button>
                </div>
            </div>
        `}).join('');
    }

    const externalEntries = Object.entries(externalWidgets);
    if (externalEntries.length > 0) {
        const externalNotInstalled = externalEntries.filter(([type]) => !installedTypes.includes(type));
        if (externalNotInstalled.length > 0) {
            html += externalNotInstalled.map(([type, template]) => {
                injectWidgetStyles(template);
                return `
                <div class="store-widget-card external" data-widget-type="${type}">
                    <div class="store-widget-header">
                        <span class="store-widget-name">${template.name}</span>
                        <span class="store-widget-badge external">${template.size}</span>
                    </div>
                    <p class="store-widget-desc">${template.desc || ''}</p>
                    <div class="store-widget-meta">
                        <span>${i18n('widgets.source')}: ${i18n('widgets.external')}</span>
                        <button class="store-widget-add-btn" data-widget-type="${type}">${i18n('widgets.add')}</button>
                    </div>
                </div>
            `}).join('');
        }
    }

    if (!html) {
        html = `
            <div class="empty-installed">
                <div class="empty-installed-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                </div>
                <p class="empty-installed-text">${i18n('widgets.no_addable_widgets')}</p>
            </div>
        `;
    }

    grid.innerHTML = html;

    document.querySelectorAll('.store-widget-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addWidgetFromStore(btn.dataset.widgetType);
        });
    });

    document.querySelectorAll('.store-widget-card[data-widget-type]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.store-widget-add-btn')) {
                addWidgetFromStore(card.dataset.widgetType);
            }
        });
    });
}

function initInstalledWidgetDrag() {
    const cards = document.querySelectorAll('.installed-widget-card');

    cards.forEach(card => {
        card.addEventListener('dragstart', handleInstalledDragStart);
        card.addEventListener('dragend', handleInstalledDragEnd);
        card.addEventListener('dragover', handleInstalledDragOver);
        card.addEventListener('drop', handleInstalledDrop);
        card.addEventListener('dragleave', handleInstalledDragLeave);
    });
}

function handleInstalledDragStart(e) {
    draggedWidgetEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.widgetId);
}

function handleInstalledDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.installed-widget-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedWidgetEl = null;
}

function handleInstalledDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedWidgetEl) {
        this.classList.add('drag-over');
    }
}

function handleInstalledDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleInstalledDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this === draggedWidgetEl) return;

    const draggedId = draggedWidgetEl.dataset.widgetId;
    const targetId = this.dataset.widgetId;

    const draggedIndex = installedWidgets.findIndex(w => w.id === draggedId);
    const targetIndex = installedWidgets.findIndex(w => w.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
        [installedWidgets[draggedIndex], installedWidgets[targetIndex]] =
            [installedWidgets[targetIndex], installedWidgets[draggedIndex]];
        saveWidgetsOrder();
        renderInstalledWidgets();
    }
}

async function saveWidgetsOrder() {
    try {
        await window.simpmcAPI.saveWidgets(installedWidgets);
        window.widgets = installedWidgets;
    } catch (error) {
        console.error('保存顺序失败:', error);
    }
}

async function toggleWidgetInstalled(widgetId) {
    const widget = installedWidgets.find(w => w.id === widgetId);
    if (widget) {
        widget.enabled = !widget.enabled;
        try {
            await window.simpmcAPI.saveWidgets(installedWidgets);
            window.widgets = installedWidgets;
            renderInstalledWidgets();
            showToast(widget.enabled ? i18n('widgets.enabled') : i18n('widgets.disabled'), 'success');
        } catch (error) {
            console.error('切换状态失败:', error);
            showToast(i18n('widgets.operation_failed'), 'error');
        }
    }
}

function confirmRemoveWidget(widgetId) {
    const widget = installedWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const message = i18n('widgets.remove_confirm_message').replace('{name}', widget.name);
    showConfirmModal(
        i18n('widgets.remove_confirm_title'),
        message,
        async () => {
            try {
                await window.simpmcAPI.removeWidget(widgetId);
                installedWidgets = installedWidgets.filter(w => w.id !== widgetId);
                window.widgets = installedWidgets;
                renderInstalledWidgets();
                renderStoreWidgets();
                showToast(i18n('widgets.removed'), 'success');
            } catch (error) {
                console.error('删除失败:', error);
                showToast(i18n('widgets.remove_failed'), 'error');
            }
            closeConfirmModal();
        }
    );
}

async function addWidgetFromStore(type) {
    const template = WIDGET_TEMPLATES[type] || externalWidgets[type];
    if (!template) return;

    const newWidget = {
        id: 'widget_' + Date.now(),
        type: type,
        name: template.name,
        size: template.size,
        enabled: true,
        config: {},
        source: template.source,
        sourceUrl: template.sourceUrl,
        version: template.version,
        template: { ...template }
    };

    try {
        await window.simpmcAPI.addWidget(newWidget);
        installedWidgets.push(newWidget);
        window.widgets = installedWidgets;
        renderInstalledWidgets();
        renderStoreWidgets();
        showToast(i18n('widgets.added').replace('{name}', template.name), 'success');
    } catch (error) {
        console.error('添加失败:', error);
        showToast(i18n('widgets.add_failed'), 'error');
    }
}

async function importExternalWidget(url) {
    showLoading();
    try {
        const widgets = await loadExternalWidget(url);
        if (widgets && Object.keys(widgets).length > 0) {
            Object.assign(externalWidgets, widgets);
            window.externalWidgets = externalWidgets;
            renderStoreWidgets();
            showToast(i18n('widgets.external_import_success'), 'success');
        } else {
            showToast(i18n('widgets.no_valid_widgets'), 'error');
        }
    } catch (error) {
        console.error('导入失败:', error);
        showToast(i18n('widgets.import_failed'), 'error');
    } finally {
        hideLoading();
        closeExternalImportModal();
    }
}

function initWidgetIntervals() {
    Object.values(widgetIntervals).forEach(interval => clearInterval(interval));
    widgetIntervals = {};

    installedWidgets.forEach(widget => {
        if (!widget.enabled) return;
        const template = getTemplate(widget);
        if (template?.refreshInterval) {
            widgetIntervals[widget.id] = setInterval(() => {
                renderWidgetContent(widget.id);
            }, template.refreshInterval);
        }
    });
}

function renderWidgetContent(widgetId) {
    const widget = installedWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    const template = getTemplate(widget);
    if (!template) return;

    const contentEl = document.querySelector(`[data-widget-id="${widgetId}"] .widget-content`);
    if (!contentEl) return;

    try {
        let content = '';

        if (template.html) {
            content = template.html;
        }

        if (template.render) {
            try {
                const renderFn = new Function('config', 'widget', template.render);
                content = renderFn(widget.config || {}, widget);
            } catch (e) {
                console.error('渲染函数执行失败:', e);
                content = `<div>${i18n('widgets.render_error')}</div>`;
            }
        }

        contentEl.innerHTML = content;

        if (template.scripts) {
            const scriptFn = new Function('config', 'widget', 'contentEl', template.scripts);
            scriptFn(widget.config || {}, widget, contentEl);
        }
    } catch (e) {
        console.error('渲染小组件内容失败:', e);
        contentEl.innerHTML = `<div>${i18n('widgets.error')}</div>`;
    }
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-btn' && confirmCallback) {
        confirmCallback();
    }

    if (e.target.classList.contains('confirm-btn') && e.target.classList.contains('cancel')) {
        closeConfirmModal();
    }

    if (e.target.id === 'security-warning-confirm-btn' && externalImportCallback) {
        externalImportCallback();
        closeSecurityWarningModal();
    }

    if (e.target.id === 'security-warning-cancel-btn') {
        closeSecurityWarningModal();
        closeExternalImportModal();
    }

    if (e.target.id === 'external-import-btn') {
        showSecurityWarningModal(null, () => {
            const input = document.getElementById('external-widget-url');
            if (input && input.value.trim()) {
                importExternalWidget(input.value.trim());
            } else {
                showToast(i18n('widgets.invalid_url'), 'error');
            }
        });
        showExternalImportModal();
    }

    if (e.target.id === 'external-import-cancel-btn') {
        closeExternalImportModal();
        closeSecurityWarningModal();
    }

    if (e.target.id === 'external-import-confirm-btn') {
        const input = document.getElementById('external-widget-url');
        if (input && input.value.trim()) {
            closeSecurityWarningModal();
            importExternalWidget(input.value.trim());
        } else {
            showToast(i18n('widgets.invalid_url'), 'error');
        }
    }

    const addBtn = e.target.closest('#add-widget-btn');
    if (addBtn) {
        const storeSection = document.querySelector('.widgets-store-section');
        if (storeSection) {
            storeSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    if (e.target.id === 'widget-config-confirm-btn' && configWidgetCallback) {
        configWidgetCallback();
    }

    if (e.target.id === 'widget-config-cancel-btn' || e.target.id === 'widget-config-close-btn') {
        closeWidgetConfigModal();
    }
});