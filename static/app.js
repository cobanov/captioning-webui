const state = {
    images: [],
    processing: false
};

// Elements
const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('modelSelect');
const folderPathInput = document.getElementById('folderPath');
const loadBtn = document.getElementById('loadBtn');
const grid = document.getElementById('grid');
const actionBar = document.getElementById('actionBar');
const imageCount = document.getElementById('imageCount');
const captionAllBtn = document.getElementById('captionAllBtn');
const skipExistingCheckbox = document.getElementById('skipExisting');
const modelPriceSpan = document.getElementById('modelPrice');

const PRICING = {
    'gpt-4.1-mini': '$0.40',
    'gpt-4.1-nano': '$0.10',
    'gpt-5-nano': '$0.05',
    'gpt-5-mini': '$0.25',
    'gpt-5.1': '$1.25'
};

function updatePrice() {
    const model = modelSelect.value;
    if (PRICING[model]) {
        modelPriceSpan.textContent = PRICING[model];
    } else {
        modelPriceSpan.textContent = '';
    }
}

// Load settings from localStorage
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('apiKey')) apiKeyInput.value = localStorage.getItem('apiKey');
    if (localStorage.getItem('folderPath')) {
        const savedPath = localStorage.getItem('folderPath');
        folderPathInput.value = savedPath;
        // Auto-load if path exists
        loadImages(savedPath);
    }
    if (localStorage.getItem('model')) {
        modelSelect.value = localStorage.getItem('model');
    }
    // Ensure value is valid (if cached model is old), otherwise default to first
    if (!PRICING[modelSelect.value]) {
        modelSelect.value = 'gpt-4.1-mini'; 
    }
    updatePrice();
});

// Save settings
apiKeyInput.addEventListener('change', () => localStorage.setItem('apiKey', apiKeyInput.value));
folderPathInput.addEventListener('change', () => localStorage.setItem('folderPath', folderPathInput.value));
modelSelect.addEventListener('change', () => {
    localStorage.setItem('model', modelSelect.value);
    updatePrice();
});

// Scan Folder
// Scan Folder Logic
async function loadImages(path) {
    const folderPath = path ? path.trim() : folderPathInput.value.trim();
    if (!folderPath) return alert('Please enter a folder path');

    // Update input if path was passed
    if (path) {
        folderPathInput.value = path;
        localStorage.setItem('folderPath', path);
    }

    loadBtn.disabled = true;
    loadBtn.textContent = 'Scanning...';

    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: folderPath })
        });
        
        if (!res.ok) throw await res.json();
        
        state.images = await res.json();
        renderGrid();
        
        if (state.images.length > 0) {
            actionBar.classList.remove('hidden');
            imageCount.textContent = `${state.images.length} images found`;
        } else {
            actionBar.classList.add('hidden');
        }

    } catch (err) {
        alert('Error: ' + (err.detail || err.message));
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Select Folder';
    }
}

// Button Click -> Open Dialog
loadBtn.addEventListener('click', async () => {
    // If there is already a path in input, should we just load it? 
    // User asked "load images button should open folder selection window".
    // So we prioritize opening the window.
    try {
        loadBtn.disabled = true;
        loadBtn.textContent = 'Selecting...';
        
        const res = await fetch('/api/select-folder', { method: 'POST' });
        if (!res.ok) throw await res.json();
        
        const data = await res.json();
        if (data.folder_path) {
            await loadImages(data.folder_path);
        } else {
            // User canceled
            loadBtn.disabled = false;
            loadBtn.textContent = 'Select Folder';
        }
    } catch (err) {
        console.error(err);
        // Fallback to manual load if dialog fails?
        loadImages();
    }
});

// Allow manual entry with Enter key
folderPathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        loadImages(folderPathInput.value);
    }
});

function renderGrid() {
    grid.innerHTML = '';
    
    if (state.images.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No images found in this folder</p></div>`;
        return;
    }

    state.images.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;
        
        // Fix for image loading path needs to go through API
        // We use encodeURIComponent to handle weird characters in path
        const imgSrc = `/api/image?path=${encodeURIComponent(img.absolute_path)}`;
        
        card.innerHTML = `
            <div class="img-container">
                <img src="${imgSrc}" loading="lazy" alt="${img.filename}">
                <div class="status-badge ${img.has_caption ? 'done' : ''}" id="status-${index}">
                    ${img.has_caption ? 'Captioned' : 'Ready'}
                </div>
            </div>
            <div class="card-body">
                <div class="filename" title="${img.filename}">${img.filename}</div>
                <textarea id="caption-${index}" placeholder="Caption will appear here..." onblur="saveSingle(${index})">${img.caption_content || ''}</textarea>
                <div class="card-actions">
                    <button class="card-btn" onclick="generateSingle(${index})">Generate</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Generate Single Caption
window.generateSingle = async (index) => {
    const img = state.images[index];
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) return alert('Please enter OpenAI API Key');
    
    // Save API Key on usage
    localStorage.setItem('apiKey', apiKey);
    
    const textarea = document.getElementById(`caption-${index}`);
    const statusIdx = document.getElementById(`status-${index}`);
    
    textarea.disabled = true;
    statusIdx.textContent = 'Generating...';
    
    try {
        const res = await fetch('/api/caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                model: modelSelect.value,
                image_path: img.absolute_path
            })
        });
        
        if (!res.ok) throw await res.json();
        
        const data = await res.json();
        textarea.value = data.caption;
        statusIdx.textContent = 'Generated';
        
        // Auto-save after generation
        await window.saveSingle(index);
        
    } catch (err) {
        console.error(err);
        statusIdx.textContent = 'Error';
        alert('Error generating caption: ' + (err.detail || err.message));
    } finally {
        textarea.disabled = false;
    }
};

// Save Single Caption
window.saveSingle = async (index) => {
    const img = state.images[index];
    const textarea = document.getElementById(`caption-${index}`);
    const statusIdx = document.getElementById(`status-${index}`);
    const caption = textarea.value.trim();
    
    if (!caption) return alert('Caption is empty');
    
    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: img.absolute_path,
                caption_text: caption
            })
        });
        
        if (!res.ok) throw await res.json();
        
        statusIdx.textContent = 'Saved';
        statusIdx.classList.add('done');
        
        // Update local state
        img.has_caption = true;
        img.caption_content = caption;
        
    } catch (err) {
        alert('Error saving: ' + (err.detail || err.message));
    }
};

// Caption All
captionAllBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return alert('Please enter OpenAI API Key');
    
    // Save API Key on usage
    localStorage.setItem('apiKey', apiKey);
    
    if (state.processing) return;
    state.processing = true;
    captionAllBtn.disabled = true;
    captionAllBtn.innerHTML = 'Processing...';
    
    const skipExisting = skipExistingCheckbox.checked;
    
    try {
        // Iterate sequentially or parallel? Browser limit connection usually 6.
        // Let's do sequential to avoid hitting rate limits too hard.
        
        for (let i = 0; i < state.images.length; i++) {
            const img = state.images[i];
            
            // Skip logic
            if (skipExisting && img.has_caption) continue;
            
            // Scroll into view if possible
            const card = grid.children[i];
            
            // Generate (includes auto-save now)
            await window.generateSingle(i);
        }
    } catch (err) {
        console.error("Batch process error", err);
    } finally {
        state.processing = false;
        captionAllBtn.disabled = false;
        captionAllBtn.innerHTML = `
            Caption All
        `;
    }
});
