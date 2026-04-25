let installedVersions = [];
let widgets = [];
let widgetPositions = {};
let draggedWidget = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

window.loadHomePage = loadHomePage;
window.loadWidgetTemplates = loadWidgetTemplates;
window.loadWidgets = loadWidgets;
window.renderWidgets = renderWidgets;

function injectWidgetStyles(template) {
    if (!template || !template.styles) return;
    if (document.getElementById('widget-styles-' + template.type)) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'widget-styles-' + template.type;
    styleEl.textContent = template.styles;
    document.head.appendChild(styleEl);
}

async function loadHomePage() {
    await loadWidgetTemplates();
    await loadWidgets();
    renderWidgets();
}

async function loadWidgets() {
    try {
        console.log('开始加载小组件数据...');
        const data = await window.simpmcAPI.getWidgets();
        console.log('获取到小组件数据:', data);
        widgets = data.widgets || [];
        widgetPositions = data.positions || {};
        window.widgets = widgets;
        console.log('处理后的小组件:', widgets);
    } catch (error) {
        console.error('加载小组件失败:', error);
        widgets = [];
        window.widgets = widgets;
    }
}

function renderWidgets() {
    const grid = document.getElementById('widgets-grid');
    if (!grid) {
        console.error('widgets-grid 元素不存在');
        return;
    }

    console.log('=== renderWidgets 被调用 ===');
    console.log('window.widgets:', window.widgets);
    console.log('window.WIDGET_TEMPLATES:', window.WIDGET_TEMPLATES);
    console.log('window.externalWidgets:', window.externalWidgets);

    widgets = window.widgets || [];
    WIDGET_TEMPLATES = window.WIDGET_TEMPLATES || {};
    externalWidgets = window.externalWidgets || {};

    console.log('渲染前 - widgets:', widgets);
    console.log('渲染前 - WIDGET_TEMPLATES:', WIDGET_TEMPLATES);

    if (widgets.length === 0) {
        grid.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">还没有添加小组件</div>';
        console.log('没有小组件可渲染');
        return;
    }

    grid.innerHTML = widgets.map(widget => {
        console.log('渲染小组件:', widget);
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        if (!template) {
            console.warn('找不到小组件模板:', widget.type);
            return '';
        }

        injectWidgetStyles(template);

        let content = template.html || '';

        if (template.render) {
            try {
                const renderFn = new Function('config', 'widget', template.render);
                content = renderFn(widget.config || {}, widget);
            } catch (e) {
                console.error('渲染函数执行失败:', e);
                content = '<div>渲染错误</div>';
            }
        }

        const sizeClass = `size-${widget.size || '1x1'}`;

        return `
            <div class="widget-card ${sizeClass} ${widget.enabled ? '' : 'disabled'}"
                 data-widget-id="${widget.id}"
                 data-widget-type="${widget.type}"
                 draggable="true">
                <div class="widget-content">
                    ${content}
                </div>
                <div class="widget-actions">
                    <button class="widget-action-btn widget-toggle-btn" data-widget-id="${widget.id}" title="启用/禁用">
                            ${widget.enabled ?
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' :
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
                            }
                    </button>
                    <button class="widget-action-btn delete widget-remove-btn" data-widget-id="${widget.id}" title="删除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    console.log('小组件渲染完成');

    document.querySelectorAll('.widget-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleWidget(btn.dataset.widgetId));
    });
    document.querySelectorAll('.widget-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeWidget(btn.dataset.widgetId));
    });

    initWidgetScripts();
    initWidgetDrag();
}

function initWidgetScripts() {
    widgets.forEach(widget => {
        if (!widget.enabled) return;
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        if (!template || !template.scripts) return;

        const contentEl = document.querySelector(`[data-widget-id="${widget.id}"] .widget-content`);
        if (!contentEl) return;

        contentEl._widgetIntervals = contentEl._widgetIntervals || [];

        try {
            const scriptFn = new Function('config', 'widget', 'contentEl', template.scripts);
            scriptFn(widget.config || {}, widget, contentEl);
        } catch (e) {
            console.error('执行小组件脚本失败:', e);
        }
    });
}

function cleanupWidgetScripts(widgetId) {
    const contentEl = document.querySelector(`[data-widget-id="${widgetId}"] .widget-content`);
    if (!contentEl) return;

    if (contentEl._widgetIntervals) {
        contentEl._widgetIntervals.forEach(interval => clearInterval(interval));
        contentEl._widgetIntervals = [];
    }
}

function initWidgetDrag() {
    const cards = document.querySelectorAll('.widget-card');

    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedWidget = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.widgetId);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.widget-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedWidget = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedWidget) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this === draggedWidget) return;

    const draggedId = draggedWidget.dataset.widgetId;
    const targetId = this.dataset.widgetId;

    const draggedIndex = widgets.findIndex(w => w.id === draggedId);
    const targetIndex = widgets.findIndex(w => w.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
        [widgets[draggedIndex], widgets[targetIndex]] = [widgets[targetIndex], widgets[draggedIndex]];
        saveWidgetPositions();
        renderWidgets();
    }
}

async function toggleWidget(widgetId) {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        widget.enabled = !widget.enabled;
        await window.simpmcAPI.saveWidgets(widgets);
        renderWidgets();
    }
}

async function removeWidget(widgetId) {
    if (confirm('确定要删除这个小组件吗？')) {
        widgets = widgets.filter(w => w.id !== widgetId);
        await window.simpmcAPI.saveWidgets(widgets);
        renderWidgets();
    }
}

async function saveWidgetPositions() {
    const positions = {};
    widgets.forEach((widget, index) => {
        positions[widget.id] = index;
    });
    await window.simpmcAPI.saveWidgetPositions(positions);
    await window.simpmcAPI.saveWidgets(widgets);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function playVersion(versionId) {
    console.log('Playing version:', versionId);
    alert('游戏启动功能开发中...');
}