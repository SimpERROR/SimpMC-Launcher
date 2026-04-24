const WIDGET_TEMPLATES_URL = 'https://raw.githubusercontent.com/SimpERROR/SimpMC-Launcher/refs/heads/main/SimpMC_Assets/widgets.json';
let WIDGET_TEMPLATES = {};

async function loadWidgetTemplates() {
    try {
        console.log('开始加载小组件模板...');
        const response = await fetch(WIDGET_TEMPLATES_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data.widgets && Array.isArray(data.widgets)) {
            data.widgets.forEach(template => {
                if (template.type) {
                    WIDGET_TEMPLATES[template.type] = template;
                }
            });
            console.log('加载了小组件模板:', Object.keys(WIDGET_TEMPLATES));
        }
    } catch (error) {
        console.error('从服务器加载小组件模板失败:', error);
        WIDGET_TEMPLATES = {};
    }
}

let installedWidgets = [];
let draggedWidgetEl = null;
let confirmCallback = null;

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

async function loadWidgetsPage() {
    showLoading();
    try {
        await loadWidgetTemplates();
        const data = await window.simpmcAPI.getWidgets();
        installedWidgets = data.widgets || [];
        renderInstalledWidgets();
        renderStoreWidgets();
    } catch (error) {
        console.error('加载小组件失败:', error);
        showToast('加载小组件失败', 'error');
    } finally {
        hideLoading();
    }
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
                <p class="empty-installed-text" data-i18n="widgets.no_installed">还没有安装任何小组件</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = installedWidgets.map((widget) => {
        const template = WIDGET_TEMPLATES[widget.type] || { name: widget.type, size: widget.size };
        return `
            <div class="installed-widget-card" data-widget-id="${widget.id}" draggable="true">
                <div class="installed-widget-header">
                    <div class="installed-widget-info">
                        <div class="installed-widget-name">
                            ${widget.name}
                            <span class="widget-type-badge ${widget.enabled ? 'enabled' : 'disabled'}">
                                ${widget.enabled ? '启用' : '禁用'}
                            </span>
                        </div>
                        <div class="installed-widget-size">
                            <span class="size-badge">${widget.size}</span>
                            <span>${template.desc || ''}</span>
                        </div>
                    </div>
                    <div class="installed-widget-actions">
                        <button class="widget-action-btn move" title="拖动排序">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="5" r="2"></circle>
                                <circle cx="15" cy="5" r="2"></circle>
                                <circle cx="9" cy="12" r="2"></circle>
                                <circle cx="15" cy="12" r="2"></circle>
                                <circle cx="9" cy="19" r="2"></circle>
                                <circle cx="15" cy="19" r="2"></circle>
                            </svg>
                        </button>
                        <button class="widget-action-btn widget-toggle-btn" data-widget-id="${widget.id}" title="${widget.enabled ? '禁用' : '启用'}">
                            ${widget.enabled ?
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' :
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
                            }
                        </button>
                        <button class="widget-action-btn delete widget-remove-btn" data-widget-id="${widget.id}" title="删除">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="installed-widget-preview">
                    ${template.desc || '预览区域'}
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
                <p class="empty-installed-text">无法加载小组件商店</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = Object.entries(WIDGET_TEMPLATES).map(([type, template]) => {
        const isInstalled = installedTypes.includes(type);
        return `
            <div class="store-widget-card ${isInstalled ? 'installed' : ''}" data-widget-type="${type}">
                <div class="store-widget-header">
                    <span class="store-widget-name">${template.name}</span>
                    <span class="store-widget-badge ${isInstalled ? 'installed' : ''}">
                        ${isInstalled ? '已安装' : template.size}
                    </span>
                </div>
                <p class="store-widget-desc">${template.desc || ''}</p>
                <div class="store-widget-meta">
                    <span>分类: ${template.category || 'other'}</span>
                    ${!isInstalled ? `<button class="store-widget-add-btn" data-widget-type="${type}">添加</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.store-widget-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addWidgetFromStore(btn.dataset.widgetType);
        });
    });

    document.querySelectorAll('.store-widget-card:not(.installed)').forEach(card => {
        card.addEventListener('click', () => {
            addWidgetFromStore(card.dataset.widgetType);
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
            renderInstalledWidgets();
            showToast(widget.enabled ? '已启用' : '已禁用', 'success');
        } catch (error) {
            console.error('切换状态失败:', error);
            showToast('操作失败', 'error');
        }
    }
}

function confirmRemoveWidget(widgetId) {
    const widget = installedWidgets.find(w => w.id === widgetId);
    if (!widget) return;

    showConfirmModal(
        '删除小组件',
        `确定要删除 "${widget.name}" 吗？删除后可以在商店重新添加。`,
        async () => {
            try {
                await window.simpmcAPI.removeWidget(widgetId);
                installedWidgets = installedWidgets.filter(w => w.id !== widgetId);
                renderInstalledWidgets();
                renderStoreWidgets();
                showToast('已删除', 'success');
            } catch (error) {
                console.error('删除失败:', error);
                showToast('删除失败', 'error');
            }
            closeConfirmModal();
        }
    );
}

async function addWidgetFromStore(type) {
    const template = WIDGET_TEMPLATES[type];
    if (!template) return;

    const newWidget = {
        id: 'widget_' + Date.now(),
        type: type,
        name: template.name,
        size: template.size,
        enabled: true,
        config: {}
    };

    try {
        await window.simpmcAPI.addWidget(newWidget);
        installedWidgets.push(newWidget);
        renderInstalledWidgets();
        renderStoreWidgets();
        showToast(`已添加 ${template.name}`, 'success');
    } catch (error) {
        console.error('添加失败:', error);
        showToast('添加失败', 'error');
    }
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-btn' && confirmCallback) {
        confirmCallback();
    }

    const addBtn = e.target.closest('#add-widget-btn');
    if (addBtn) {
        const storeSection = document.querySelector('.widgets-store-section');
        if (storeSection) {
            storeSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
});