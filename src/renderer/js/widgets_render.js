let widgets = [];
let draggedWidget = null;
let gridConfig = {
    columns: 4,
    cellWidth: 0,
    cellHeight: 120,
    gap: 16,
    containerHeight: 400
};

window.loadHomePage = loadHomePage;
window.loadWidgetTemplates = loadWidgetTemplates;
window.loadWidgets = loadWidgets;
window.renderWidgets = renderWidgets;

function getWTTemplates() {
    return window.WIDGET_TEMPLATES || {};
}

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
        window.widgets = widgets;
        console.log('处理后的小组件:', widgets);
    } catch (error) {
        console.error('加载小组件失败:', error);
        widgets = [];
        window.widgets = widgets;
    }
}

function getWidgetSize(widget) {
    const size = widget.size || '1x1';
    const [w, h] = size.split('x').map(Number);
    return { width: w, height: h };
}

function calculateLayout() {
    const gridEl = document.getElementById('widgets-grid');
    if (!gridEl) return [];

    const containerWidth = gridEl.offsetWidth;
    gridConfig.cellWidth = (containerWidth - (gridConfig.columns - 1) * gridConfig.gap) / gridConfig.columns;

    const placements = [];
    const occupiedGrid = Array.from({ length: 100 }, () => Array(gridConfig.columns).fill(false));

    widgets.forEach((widget, index) => {
        if (!widget.enabled) return;

        const WIDGET_TEMPLATES = getWTTemplates();
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        if (!template) return;

        const { width, height } = getWidgetSize(widget);
        const pos = widget.position;

        if (pos && canPlace(occupiedGrid, pos.row, pos.col, width, height)) {
            placeWidget(occupiedGrid, placements, widget, pos.row, pos.col, width, height);
        } else {
            let placed = false;
            for (let row = 0; row < 100 && !placed; row++) {
                for (let col = 0; col <= gridConfig.columns - width && !placed; col++) {
                    if (canPlace(occupiedGrid, row, col, width, height)) {
                        placeWidget(occupiedGrid, placements, widget, row, col, width, height);
                        placed = true;
                    }
                }
            }

            if (!placed) {
                const row = findNextFreeRow(occupiedGrid);
                placeWidget(occupiedGrid, placements, widget, row, 0, width, height);
            }
        }
    });

    const maxRow = placements.length > 0 ? Math.max(...placements.map(p => p.row + p.height)) : 0;
    gridConfig.containerHeight = Math.max(400, maxRow * (gridConfig.cellHeight + gridConfig.gap) + gridConfig.gap);

    return placements;
}

function canPlace(grid, row, col, width, height) {
    for (let r = row; r < row + height && r < grid.length; r++) {
        for (let c = col; c < col + width && c < grid[0].length; c++) {
            if (grid[r][c]) return false;
        }
    }
    return true;
}

function placeWidget(grid, placements, widget, row, col, width, height) {
    for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) {
            if (grid[r]) grid[r][c] = true;
        }
    }

    placements.push({
        widget,
        row,
        col,
        width,
        height,
        x: col * (gridConfig.cellWidth + gridConfig.gap),
        y: row * (gridConfig.cellHeight + gridConfig.gap),
        w: width * gridConfig.cellWidth + (width - 1) * gridConfig.gap,
        h: height * gridConfig.cellHeight + (height - 1) * gridConfig.gap
    });
}

function findNextFreeRow(grid) {
    for (let row = 0; row < grid.length; row++) {
        if (grid[row].some(cell => cell)) return row;
    }
    return grid.length;
}

function renderWidgets() {
    const grid = document.getElementById('widgets-grid');
    if (!grid) {
        console.error('widgets-grid 元素不存在');
        return;
    }

    console.log('=== renderWidgets 被调用 ===');

    widgets = window.widgets || [];

    console.log('渲染前 - widgets:', widgets);

    if (widgets.length === 0) {
        grid.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">还没有添加小组件</div>';
        grid.style.height = '200px';
        console.log('没有小组件可渲染');
        return;
    }

    const placements = calculateLayout();
    grid.style.height = gridConfig.containerHeight + 'px';

    const WIDGET_TEMPLATES = getWTTemplates();

    grid.innerHTML = placements.map(placement => {
        const { widget, x, y, w, h } = placement;
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        if (!template) return '';

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

        return `
            <div class="widget-card ${widget.enabled ? '' : 'disabled'}"
                 data-widget-id="${widget.id}"
                 data-widget-type="${widget.type}"
                 draggable="true"
                 style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;">
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
    const WIDGET_TEMPLATES = getWTTemplates();
    widgets.forEach(widget => {
        if (!widget.enabled) return;
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        console.log('检查小组件:', widget.type, '模板:', template ? '找到' : '未找到', '脚本:', template?.scripts ? '有' : '无');
        if (!template || !template.scripts) return;

        const contentEl = document.querySelector(`[data-widget-id="${widget.id}"] .widget-content`);
        if (!contentEl) {
            console.log('未找到 contentEl for widget:', widget.id);
            return;
        }

        contentEl._widgetIntervals = contentEl._widgetIntervals || [];

        try {
            console.log('执行脚本 for widget:', widget.type);
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
    const grid = document.getElementById('widgets-grid');
    if (!grid) return;

    grid.addEventListener('dragover', handleGridDragOver);
    grid.addEventListener('drop', handleGridDrop);

    document.querySelectorAll('.widget-card').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
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
    draggedWidget = null;
    document.querySelectorAll('.widget-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

function handleGridDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleGridDrop(e) {
    e.preventDefault();
    if (!draggedWidget) return;

    const grid = document.getElementById('widgets-grid');
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.round(x / (gridConfig.cellWidth + gridConfig.gap));
    const row = Math.round(y / (gridConfig.cellHeight + gridConfig.gap));

    const widgetId = draggedWidget.dataset.widgetId;
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    const { width, height } = getWidgetSize(widget);
    const clampedCol = Math.max(0, Math.min(col, gridConfig.columns - width));
    const clampedRow = Math.max(0, row);

    reorderWidget(widgetId, clampedCol, clampedRow);
}

function reorderWidget(widgetId, newCol, newRow) {
    const widgetIndex = widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;

    const widget = widgets[widgetIndex];
    const { width, height } = getWidgetSize(widget);

    widgets.splice(widgetIndex, 1);

    const occupiedGrid = buildOccupiedGrid();
    const placed = tryPlaceAt(occupiedGrid, widget, newCol, newRow, width, height);

    if (!placed) {
        widgets.push(widget);
    }

    window.simpmcAPI.saveWidgets(widgets).then(() => {
        window.widgets = widgets;
        renderWidgets();
    }).catch(err => {
        console.error('保存失败:', err);
    });
}

function buildOccupiedGrid() {
    const grid = Array.from({ length: 100 }, () => Array(gridConfig.columns).fill(false));
    const WIDGET_TEMPLATES = getWTTemplates();

    widgets.forEach(widget => {
        if (!widget.enabled) return;
        const template = WIDGET_TEMPLATES[widget.type] || externalWidgets[widget.type];
        if (!template) return;

        const pos = widget.position || { col: 0, row: 0 };
        const { width, height } = getWidgetSize(widget);

        for (let r = pos.row; r < pos.row + height && r < grid.length; r++) {
            for (let c = pos.col; c < pos.col + width && c < grid[0].length; c++) {
                if (grid[r]) grid[r][c] = true;
            }
        }
    });

    return grid;
}

function tryPlaceAt(grid, widget, col, row, width, height) {
    col = Math.max(0, Math.min(col, gridConfig.columns - width));
    row = Math.max(0, row);

    if (canPlace(grid, row, col, width, height)) {
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                if (grid[r]) grid[r][c] = true;
            }
        }
        widget.position = { col, row };
        widgets.push(widget);
        return true;
    }

    const alternatives = [];
    for (let r = 0; r < row + 10 && r < 100; r++) {
        for (let c = 0; c < gridConfig.columns; c++) {
            if (canPlace(grid, r, c, width, height)) {
                alternatives.push({ col: c, row: r, dist: Math.abs(r - row) + Math.abs(c - col) });
            }
        }
    }

    alternatives.sort((a, b) => a.dist - b.dist);

    if (alternatives.length > 0) {
        const best = alternatives[0];
        for (let r = best.row; r < best.row + height; r++) {
            for (let c = best.col; c < best.col + width; c++) {
                if (grid[r]) grid[r][c] = true;
            }
        }
        widget.position = { col: best.col, row: best.row };
        widgets.push(widget);
        return true;
    }

    return false;
}

async function toggleWidget(widgetId) {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        widget.enabled = !widget.enabled;
        try {
            await window.simpmcAPI.saveWidgets(widgets);
            window.widgets = widgets;
            renderWidgets();
        } catch (error) {
            console.error('切换状态失败:', error);
        }
    }
}

async function removeWidget(widgetId) {
    if (confirm('确定要删除这个小组件吗？')) {
        try {
            await window.simpmcAPI.removeWidget(widgetId);
            widgets = widgets.filter(w => w.id !== widgetId);
            window.widgets = widgets;
            renderWidgets();
        } catch (error) {
            console.error('删除失败:', error);
        }
    }
}