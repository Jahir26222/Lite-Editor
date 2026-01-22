let elements = [];
let selectedId = null;

// Interaction State
let isDragging = false;
let isResizing = false;
let activeHandle = null;
let startX, startY, startW, startH, startLeft, startTop;

const canvas = document.getElementById('canvas');
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// --- 1. Startup & Auto-Load ---
window.onload = () => {
    const saved = localStorage.getItem('liteedit_v4');
    if (saved) {
        elements = JSON.parse(saved);
        render();
    }
};

function saveToLocal() {
    localStorage.setItem('liteedit_v4', JSON.stringify(elements));
}

// --- 2. Keyboard Logic ---
window.addEventListener('keydown', (e) => {
    const isTyping = 
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.contentEditable === "true";

    if (isTyping) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
            elements = elements.filter(el => el.id !== selectedId);
            selectedId = null;
            saveToLocal();
            render();
        }
    }
});

// --- 3. Create Elements ---
function addElement(type) {
    const id = 'el_' + Date.now();
    const newEl = {
        id, type,
        x: 50, y: 50, w: 150, h: type === 'text' ? 50 : 150,
        color: '#0d9aff00', 
        text: type === 'text' ? 'Type here' : '',
        rotate: 0,
        zIndex: elements.length
    };
    elements.push(newEl);
    saveToLocal();
    selectElement(id);
}

// --- 4. Render Engine ---
function render() {
    // If the user is currently typing, we skip the visual re-render 
    // to prevent the cursor from jumping to the start of the text.
    if (document.activeElement && document.activeElement.contentEditable === "true") return;

    canvas.innerHTML = '';
    
    elements.sort((a, b) => a.zIndex - b.zIndex).forEach(el => {
        const div = document.createElement('div');
        div.className = `canvas-element ${selectedId === el.id ? 'selected' : ''}`;
        div.id = el.id;
        
        div.style.left = `${el.x}px`;
        div.style.top = `${el.y}px`;
        div.style.width = `${el.w}px`;
        div.style.height = `${el.h}px`;
        div.style.transform = `rotate(${el.rotate}deg)`;
        div.style.zIndex = el.zIndex;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';

        if (el.type === 'text') {
            div.innerText = el.text;
            div.style.color = el.color;
            div.style.border = "none";
            
            div.ondblclick = (e) => {
                e.stopPropagation();
                div.contentEditable = true;
                div.focus();
            };

            div.onkeydown = (e) => {
                if (div.contentEditable === "true") {
                    e.stopPropagation(); 
                }
            };
            
            div.onblur = () => {
                div.contentEditable = false;
                el.text = div.innerText;
                saveToLocal();
                updatePropsUI();
            };
        } else {
            div.style.backgroundColor = el.color;
        }

        if (selectedId === el.id) {
            ['tl', 'tr', 'bl', 'br'].forEach(pos => {
                const h = document.createElement('div');
                h.className = `resizer ${pos}`;
                h.onmousedown = (e) => { 
                    e.stopPropagation(); 
                    initInteraction(e, el.id, true, pos); 
                };
                div.appendChild(h);
            });
        }

        div.onmousedown = (e) => {
            if (div.contentEditable === "true") return; 
            e.stopPropagation();
            selectElement(el.id); 
            initInteraction(e, el.id, false);
        };

        canvas.appendChild(div);
    });

    updateLayersUI();
    updatePropsUI();
}

// --- 5. Interaction ---
function initInteraction(e, id, resizing, handle = null) {
    const el = elements.find(i => i.id === id);
    isResizing = resizing;
    activeHandle = handle;
    isDragging = !resizing;

    startX = e.clientX; startY = e.clientY;
    startW = el.w; startH = el.h;
    startLeft = el.x; startTop = el.y;

    document.onmousemove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (isDragging) {
            el.x = Math.max(0, Math.min(startLeft + dx, CANVAS_WIDTH - el.w));
            el.y = Math.max(0, Math.min(startTop + dy, CANVAS_HEIGHT - el.h));
        } else if (isResizing) {
            if (activeHandle === 'br') { 
                el.w = Math.max(20, Math.min(startW + dx, CANVAS_WIDTH - el.x)); 
                el.h = Math.max(20, Math.min(startH + dy, CANVAS_HEIGHT - el.y)); 
            }
            if (activeHandle === 'tl') { 
                el.w = Math.max(20, startW - dx); el.h = Math.max(20, startH - dy); 
                el.x = Math.max(0, startLeft + dx); el.y = Math.max(0, startTop + dy); 
            }
            if (activeHandle === 'tr') { 
                el.w = Math.max(20, Math.min(startW + dx, CANVAS_WIDTH - el.x)); 
                el.h = Math.max(20, startH - dy); el.y = Math.max(0, startTop + dy); 
            }
            if (activeHandle === 'bl') { 
                el.w = Math.max(20, startW - dx); 
                el.h = Math.max(20, Math.min(startH + dy, CANVAS_HEIGHT - el.y)); 
                el.x = Math.max(0, startLeft + dx); 
            }
        }
        
        const domEl = document.getElementById(el.id);
        if(domEl) {
            domEl.style.left = `${el.x}px`;
            domEl.style.top = `${el.y}px`;
            domEl.style.width = `${el.w}px`;
            domEl.style.height = `${el.h}px`;
        }
        updatePropsUI();
    };

    document.onmouseup = () => {
        document.onmousemove = null;
        isDragging = false;
        isResizing = false;
        saveToLocal();
        render(); 
    };
}

// --- 6. Improved Selection & Layers ---
function selectElement(id) {
    // If we are selecting a new element, blur the old one if it was text
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    selectedId = id;
    
    // Force a visual update even if we are "typing" state
    // We use a small hack to ensure the render runs
    const tempElement = document.activeElement;
    if (tempElement && tempElement.contentEditable === "true") {
        tempElement.blur();
    }
    
    render();
}

function updateLayersUI() {
    const list = document.getElementById('layers-list');
    list.innerHTML = '';
    
    // Reverse to show top layers at the top of the list
    [...elements].reverse().forEach(el => {
        const item = document.createElement('div');
        item.style.padding = '10px 16px';
        item.style.fontSize = '12px';
        item.style.cursor = 'pointer';
        item.style.background = (selectedId === el.id) ? '#252525' : 'transparent';
        item.style.color = (selectedId === el.id) ? '#0d99ff' : '#eee';
        item.style.borderLeft = (selectedId === el.id) ? '2px solid #0d99ff' : '2px solid transparent';
        
        item.innerText = `${el.type === 'text' ? 'T' : '▢'} ${el.type}`;
        
        // Use mousedown instead of onclick for faster response and to bypass blur issues
        item.onmousedown = (e) => { 
            e.preventDefault(); // Prevents losing focus on the canvas accidentally
            e.stopPropagation(); 
            selectElement(el.id); 
        };
        
        list.appendChild(item);
    });
}

function updatePropsUI() {
    const el = elements.find(e => e.id === selectedId);
    const panel = document.getElementById('props-panel');
    const empty = document.getElementById('no-selection');

    if (!el) {
        panel.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    panel.classList.remove('hidden');
    empty.classList.add('hidden');

    document.getElementById('prop-x').value = Math.round(el.x);
    document.getElementById('prop-y').value = Math.round(el.y);
    document.getElementById('prop-w').value = Math.round(el.w);
    document.getElementById('prop-h').value = Math.round(el.h);
    document.getElementById('prop-rotate').value = el.rotate;
    document.getElementById('prop-color').value = el.color;

    const textSect = document.getElementById('text-content-section');
    if (el.type === 'text') {
        textSect.classList.remove('hidden');
        document.getElementById('prop-text-val').value = el.text;
    } else {
        textSect.classList.add('hidden');
    }
}

// Sidebar Buttons
document.getElementById('add-rect').onclick = () => addElement('rectangle');
document.getElementById('add-text').onclick = () => addElement('text');
document.getElementById('delete-btn').onclick = () => { 
    elements = elements.filter(e => e.id !== selectedId); 
    selectedId = null; 
    saveToLocal();
    render(); 
};

canvas.onclick = (e) => { if(e.target.id === 'canvas') { selectedId = null; render(); } };

document.querySelectorAll('.prop-section input, textarea').forEach(input => {
    input.onkeydown = (e) => e.stopPropagation();
    input.oninput = (e) => {
        const el = elements.find(i => i.id === selectedId);
        if (!el) return;
        const val = e.target.value;
        if (e.target.id === 'prop-x') el.x = parseInt(val) || 0;
        if (e.target.id === 'prop-y') el.y = parseInt(val) || 0;
        if (e.target.id === 'prop-w') el.w = parseInt(val) || 0;
        if (e.target.id === 'prop-h') el.h = parseInt(val) || 0;
        if (e.target.id === 'prop-rotate') el.rotate = parseInt(val) || 0;
        if (e.target.id === 'prop-color') el.color = val;
        if (e.target.id === 'prop-text-val') el.text = val;
        saveToLocal();
        render();
    };
});

// --- 8. Export Functionality ---

// Exports the raw data as a .json file
function exportJSON() {
    if (elements.length === 0) return alert("No elements to export!");

    const dataStr = JSON.stringify(elements, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = "liteedit_project.json";
    link.click();
    
    URL.revokeObjectURL(url);
}

// Exports the current canvas as a standalone .html file
function exportHTML() {
    if (elements.length === 0) return alert("No elements to export!");

    // Create the HTML structure based on current elements
    let elementHTML = "";
    elements.forEach(el => {
        const isText = el.type === 'text';
        const style = `
            position: absolute;
            left: ${el.x}px;
            top: ${el.y}px;
            width: ${el.w}px;
            height: ${el.h}px;
            transform: rotate(${el.rotate}deg);
            z-index: ${el.zIndex};
            display: flex;
            align-items: center;
            justify-content: center;
            ${isText ? `color: ${el.color};` : `background-color: ${el.color};`}
        `;
        elementHTML += `<div style="${style.replace(/\n/g, '')}">${isText ? el.text : ''}</div>\n        `;
    });

    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>LiteEdit Export</title>
    <style>
        body { margin: 0; background: #1e1e1e; }
        .canvas { 
            width: ${CANVAS_WIDTH}px; 
            height: ${CANVAS_HEIGHT}px; 
            background: #1e1e1e; 
            position: relative; 
            margin: 50px auto;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div class="canvas">
        ${elementHTML}
    </div>
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = "liteedit_design.html";
    link.click();
    
    URL.revokeObjectURL(url);
}

// --- Event Listeners for Toolbar ---
document.getElementById('export-json').onclick = exportJSON;
document.getElementById('export-html').onclick = exportHTML;