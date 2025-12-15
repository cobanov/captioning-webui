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
const includeTriggerCheckbox = document.getElementById('includeTrigger');
const modelPriceSpan = document.getElementById('modelPrice');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const toast = document.getElementById('toast');

// Toast notification helper
function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

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
    // Load checkbox states
    if (localStorage.getItem('skipExisting') !== null) {
        skipExistingCheckbox.checked = localStorage.getItem('skipExisting') === 'true';
    }
    if (localStorage.getItem('includeTrigger') !== null) {
        includeTriggerCheckbox.checked = localStorage.getItem('includeTrigger') === 'true';
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
skipExistingCheckbox.addEventListener('change', () => localStorage.setItem('skipExisting', skipExistingCheckbox.checked));
includeTriggerCheckbox.addEventListener('change', () => localStorage.setItem('includeTrigger', includeTriggerCheckbox.checked));

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
        } else {
            actionBar.classList.add('hidden');
        }

    } catch (err) {
        alert('Error: ' + (err.detail || err.message));
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load';
    }
}

// Button Click -> Load Images
loadBtn.addEventListener('click', () => {
    loadImages(folderPathInput.value);
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
                    <button class="card-btn generate-btn" onclick="generateSingle(${index})">Generate</button>
                    <button class="card-btn delete-btn" onclick="deleteCaption(${index})" title="Delete caption">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Update progress bar after rendering
    updateProgress();
}

// Update progress bar with captioned count
function updateProgress() {
    const captioned = state.images.filter(img => img.has_caption).length;
    const total = state.images.length;
    const percent = total > 0 ? (captioned / total) * 100 : 0;
    
    progressBar.classList.remove('hidden');
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${captioned} / ${total}`;
    
    // Update stats text
    imageCount.textContent = `${total} images found / ${captioned} captioned`;
}

// Generate Single Caption
window.generateSingle = async (index) => {
    const img = state.images[index];
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) return alert('Please enter OpenAI API Key');
    
    // Save API Key on usage
    localStorage.setItem('apiKey', apiKey);
    
    const card = grid.children[index];
    const textarea = document.getElementById(`caption-${index}`);
    const statusIdx = document.getElementById(`status-${index}`);
    const generateBtn = card.querySelector('.generate-btn');
    
    textarea.disabled = true;
    statusIdx.textContent = 'Generating...';
    generateBtn.classList.add('generating');
    card.classList.add('processing');
    
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
        generateBtn.classList.remove('generating');
        card.classList.remove('processing');
    }
};

// Save Single Caption
window.saveSingle = async (index) => {
    const img = state.images[index];
    const textarea = document.getElementById(`caption-${index}`);
    const statusIdx = document.getElementById(`status-${index}`);
    let caption = textarea.value.trim();
    
    if (!caption) return alert('Caption is empty');
    
    // Prepend [trigger] if checkbox is checked
    if (includeTriggerCheckbox.checked && !caption.startsWith('[trigger]')) {
        caption = '[trigger] ' + caption;
    }
    
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
        
        // Update textarea to show what was actually saved
        textarea.value = caption;
        
        statusIdx.textContent = 'Saved';
        statusIdx.classList.add('done');
        
        // Update local state
        img.has_caption = true;
        img.caption_content = caption;
        
        // Update progress bar
        updateProgress();
        
    } catch (err) {
        alert('Error saving: ' + (err.detail || err.message));
    }
};

// Delete Caption
window.deleteCaption = async (index) => {
    const img = state.images[index];
    const textarea = document.getElementById(`caption-${index}`);
    const statusIdx = document.getElementById(`status-${index}`);
    
    // Clear textarea
    textarea.value = '';
    
    try {
        // Delete the caption file
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: img.absolute_path
            })
        });
        
        if (!res.ok) throw await res.json();
        
        statusIdx.textContent = 'Ready';
        statusIdx.classList.remove('done');
        
        // Update local state
        img.has_caption = false;
        img.caption_content = '';
        
        // Update progress bar
        updateProgress();
        
    } catch (err) {
        alert('Error deleting: ' + (err.detail || err.message));
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
    
    // Count images to process
    const toProcess = state.images.filter((img, i) => !(skipExisting && img.has_caption));
    const total = toProcess.length;
    let completed = 0;
    
    // Show progress bar
    progressBar.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = `0 / ${total}`;
    
    try {
        for (let i = 0; i < state.images.length; i++) {
            const img = state.images[i];
            
            // Skip logic
            if (skipExisting && img.has_caption) continue;
            
            // Highlight current card
            const card = grid.children[i];
            card.classList.add('processing');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Generate (includes auto-save now)
            await window.generateSingle(i);
            
            // Remove processing state
            card.classList.remove('processing');
            
            // Update progress
            completed++;
            const percent = (completed / total) * 100;
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${completed} / ${total}`;
        }
        
        // Success notification
        showToast(`All ${total} images captioned successfully!`, 'success');
        
    } catch (err) {
        console.error("Batch process error", err);
        showToast('Error during batch processing', '');
    } finally {
        state.processing = false;
        captionAllBtn.disabled = false;
        captionAllBtn.innerHTML = 'Caption All';
        
        // Hide progress bar after delay
        setTimeout(() => {
            progressBar.classList.add('hidden');
        }, 2000);
    }
});
