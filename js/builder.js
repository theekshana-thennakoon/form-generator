let currentEditTemplateId = null;

window.editTemplate = function(id, name, desc, schemaStr, themeStr) {
    const schema = typeof schemaStr === 'string' ? JSON.parse(schemaStr.replace(/&quot;/g, '"')) : schemaStr;
    const theme = typeof themeStr === 'string' ? JSON.parse(themeStr.replace(/&quot;/g, '"')) : themeStr;
    
    currentEditTemplateId = id;
    const listView = document.getElementById('list-view');
    const builderView = document.getElementById('builder-view');
    const btnSave = document.getElementById('save-template-btn');
    const builderTitle = document.querySelector('#builder-view .section-header h3');
    const questionsContainer = document.getElementById('questions-container');

    builderTitle.textContent = "Edit Form Template";
    btnSave.textContent = "Update Form Template";
    document.getElementById('form-title').value = name;
    document.getElementById('form-description').value = desc;
    document.getElementById('form-image-url').value = theme.logoUrl || '';

    document.getElementById('theme-primary').value = theme.primary || '#ef4444';
    document.getElementById('theme-bg').value = theme.bg || '#f8fafc';
    document.getElementById('theme-card').value = theme.card || '#ffffff';

    questionsContainer.innerHTML = '';
    schema.forEach(q => window.addQuestionBlock(q.label, q.type, q.options));

    listView.classList.remove('active');
    builderView.classList.add('active');
};

document.addEventListener('DOMContentLoaded', () => {
    fetchTemplates();

    const listView = document.getElementById('list-view');
    const builderView = document.getElementById('builder-view');
    const btnNew = document.getElementById('btn-new-template');
    const btnCancel = document.getElementById('cancel-builder');
    const btnAddQ = document.getElementById('add-question-btn');
    const btnSave = document.getElementById('save-template-btn');
    const questionsContainer = document.getElementById('questions-container');
    const builderTitle = document.querySelector('#builder-view .section-header h3');

    // Initialize Sortable for drag-and-drop
    if (typeof Sortable !== 'undefined') {
        new Sortable(questionsContainer, {
            animation: 150,
            handle: '.drag-handle', // use the drag handle class
            ghostClass: 'sortable-ghost'
        });
    }

    // UI Navigation
    btnNew.addEventListener('click', () => {
        currentEditTemplateId = null;
        builderTitle.textContent = "Build New Form";
        btnSave.textContent = "Save Form Template";
        listView.classList.remove('active');
        builderView.classList.add('active');
        questionsContainer.innerHTML = '';
        document.getElementById('form-title').value = '';
        document.getElementById('form-description').value = '';
        document.getElementById('form-image-url').value = '';
        document.getElementById('theme-primary').value = '#ef4444';
        document.getElementById('theme-bg').value = '#f8fafc';
        document.getElementById('theme-card').value = '#ffffff';
        window.addQuestionBlock(); // Add one default block
    });

    // Theme Presets Logic
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('theme-primary').value = btn.dataset.primary;
            document.getElementById('theme-bg').value = btn.dataset.bg;
            document.getElementById('theme-card').value = btn.dataset.card;
        });
    });

    const closeBuilder = () => {
        builderView.classList.remove('active');
        listView.classList.add('active');
    };

    btnCancel.addEventListener('click', closeBuilder);
    document.getElementById('back-to-list-btn').addEventListener('click', closeBuilder);

    // Image Upload Logic
    const uploadBtn = document.getElementById('upload-image-btn');
    const fileInput = document.getElementById('form-image-upload');
    const urlInput = document.getElementById('form-image-url');

    if (uploadBtn && fileInput && urlInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const originalText = uploadBtn.textContent;
            uploadBtn.textContent = 'Processing...';
            uploadBtn.disabled = true;

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    let currentMaxWidth = 400; // Smaller initial size for logos
                    let quality = 0.7;
                    let base64String = '';

                    const compress = () => {
                        let width = img.width;
                        let height = img.height;
                        if (width > currentMaxWidth) {
                            height = Math.round((height * currentMaxWidth) / width);
                            width = currentMaxWidth;
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        return canvas.toDataURL('image/jpeg', quality);
                    };

                    base64String = compress();
                    
                    // Force the string to be under 40,000 characters to survive Google Sheets limits
                    while (base64String.length > 40000 && currentMaxWidth > 100) {
                        currentMaxWidth -= 100;
                        quality -= 0.1;
                        base64String = compress();
                    }

                    if (base64String.length > 48000) {
                        Swal.fire('Error', 'Image is too complex to compress sufficiently. Please use a simpler or smaller logo.', 'error');
                        uploadBtn.textContent = originalText;
                        uploadBtn.disabled = false;
                        fileInput.value = '';
                        return;
                    }

                    urlInput.value = base64String;
                    
                    uploadBtn.textContent = originalText;
                    uploadBtn.disabled = false;
                    fileInput.value = '';
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Image Attached',
                        text: 'Your image has been optimized for storage.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Builder Logic
    btnAddQ.addEventListener('click', () => window.addQuestionBlock());

    window.addQuestionBlock = function(label = '', type = 'text', options = [], required = true) {
        const div = document.createElement('div');
        div.className = 'question-block';
        
        div.innerHTML = `
            <div class="q-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="drag-handle" style="cursor: move; font-size: 18px; color: #9ca3af; padding: 0 4px; user-select: none;" title="Drag to reorder">☰</span>
                    <strong>Question</strong>
                </div>
                <button type="button" class="remove-q-btn">X Remove</button>
            </div>
            <div class="input-group">
                <label>Question Label</label>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" class="q-label" placeholder="e.g. Engine Oil Level" value="${label}" required style="flex:1;">
                    <label style="display:flex; align-items:center; gap:4px; margin:0; white-space:nowrap; font-weight:normal; cursor:pointer;">
                        <input type="checkbox" class="q-required" ${required ? 'checked' : ''} style="margin:0; width:auto; height:auto;"> Required
                    </label>
                </div>
            </div>
            <div class="input-group">
                <label>Question Type</label>
                <select class="q-type">
                    <option value="text" ${type==='text'?'selected':''}>Short Text</option>
                    <option value="textarea" ${type==='textarea'?'selected':''}>Long Text (Paragraph)</option>
                    <option value="dropdown" ${type==='dropdown'?'selected':''}>Dropdown Select</option>
                    <option value="radio" ${type==='radio'?'selected':''}>Radio Buttons (Checklist)</option>
                    <option value="radiocards" ${type==='radiocards'?'selected':''}>Radio Buttons (Cards)</option>
                    <option value="checkbox" ${type==='checkbox'?'selected':''}>Checkbox (True/False)</option>
                    <option value="date" ${type==='date'?'selected':''}>Date Picker</option>
                    <option value="step" ${type==='step'?'selected':''}>Step Break (New Tab)</option>
                    <option value="info" ${type==='info'?'selected':''}>Information Block</option>
                    <option value="signature" ${type==='signature'?'selected':''}>Signature Pad</option>
                    <option value="selfie" ${type==='selfie'?'selected':''}>Selfie Capture</option>
                </select>
            </div>
            <div class="input-group options-container" style="${(type==='dropdown'||type==='radio'||type==='radiocards')?'display:flex':'display:none'}">
                <label>Options (comma separated)</label>
                <input type="text" class="q-options" placeholder="e.g. Good, Low, Replace" value="${options.join(', ')}">
            </div>
            <div class="input-group info-color-container" style="${(type==='info')?'display:flex':'display:none'}">
                <label>Alert Color (for Info Blocks)</label>
                <select class="q-info-color">
                    <option value="yellow" ${options[0]==='yellow'?'selected':''}>Yellow (Warning/Rules)</option>
                    <option value="red" ${options[0]==='red'?'selected':''}>Red (Legal/Danger)</option>
                    <option value="green" ${options[0]==='green'?'selected':''}>Green (Success/Accepted)</option>
                </select>
            </div>
            <div class="input-group info-content-container" style="${(type==='info')?'display:flex':'display:none'}">
                <label>Information Text (Use Enter for new lines)</label>
                <textarea class="q-info-content" rows="4">${options[1] || ''}</textarea>
            </div>
            <div class="input-group info-accept-container" style="${(type==='info')?'display:flex; flex-direction:row; align-items:center; gap:8px; margin-top:8px;':'display:none'}">
                <input type="checkbox" class="q-info-accept" style="width:16px; height:16px;" ${options[2]==='true'?'checked':''}>
                <label style="margin:0;">Include "Accept and confirm" Checkbox</label>
            </div>
            <div class="input-group info-btn-container" style="${(type==='info')?'display:flex; flex-direction:column; margin-top:8px; gap:4px;':'display:none'}">
                <label style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Action Buttons (Optional)</span>
                    <button type="button" class="btn btn-secondary btn-sm add-info-btn" style="padding:2px 8px; font-size:12px;">+ Add Button</button>
                </label>
                <div class="info-btns-list" style="display:flex; flex-direction:column; gap:8px;">
                </div>
            </div>
        `;

        // Handle type change to show options input
        const typeSelect = div.querySelector('.q-type');
        const optionsContainer = div.querySelector('.options-container');
        const infoColorContainer = div.querySelector('.info-color-container');
        const infoContentContainer = div.querySelector('.info-content-container');
        const infoAcceptContainer = div.querySelector('.info-accept-container');
        const infoBtnContainer = div.querySelector('.info-btn-container');
        const infoBtnsList = div.querySelector('.info-btns-list');
        const addInfoBtn = div.querySelector('.add-info-btn');
        
        const renderInfoBtnRow = (text = '', url = '') => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:8px; align-items:center;';
            row.innerHTML = `
                <input type="text" class="q-info-btn-text" placeholder="Button Text (e.g. View Doc)" value="${text}" style="flex:1;">
                <input type="url" class="q-info-btn-url" placeholder="URL (e.g. https://...)" value="${url}" style="flex:2;">
                <button type="button" class="btn btn-secondary btn-sm remove-info-btn" style="padding:4px 8px; color:var(--danger); border-color:var(--danger); background:transparent;">X</button>
            `;
            row.querySelector('.remove-info-btn').addEventListener('click', () => row.remove());
            infoBtnsList.appendChild(row);
        };

        if (type === 'info') {
            for (let i = 3; i < options.length; i += 2) {
                if (options[i] || options[i+1]) {
                    renderInfoBtnRow(options[i], options[i+1]);
                }
            }
        }
        addInfoBtn.addEventListener('click', () => renderInfoBtnRow());
        
        typeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'dropdown' || e.target.value === 'radio' || e.target.value === 'radiocards') {
                optionsContainer.style.display = 'flex';
            } else {
                optionsContainer.style.display = 'none';
            }
            if (e.target.value === 'info') {
                infoColorContainer.style.display = 'flex';
                infoContentContainer.style.display = 'flex';
                infoAcceptContainer.style.display = 'flex';
                infoBtnContainer.style.display = 'flex';
                
                // Initialize EasyMDE if not already initialized
                const textarea = div.querySelector('.q-info-content');
                if (!textarea.mde) {
                    textarea.mde = new EasyMDE({ 
                        element: textarea,
                        status: false,
                        spellChecker: false,
                        minHeight: "100px"
                    });
                }
            } else {
                infoColorContainer.style.display = 'none';
                infoContentContainer.style.display = 'none';
                infoAcceptContainer.style.display = 'none';
                infoBtnContainer.style.display = 'none';
            }
        });
        
        // Initialize MDE immediately if type is info (for editing)
        if (type === 'info') {
            const textarea = div.querySelector('.q-info-content');
            textarea.mde = new EasyMDE({ 
                element: textarea,
                status: false,
                spellChecker: false,
                minHeight: "100px"
            });
        }

        // Remove button
        div.querySelector('.remove-q-btn').addEventListener('click', () => div.remove());

        questionsContainer.appendChild(div);
    };

    // Save Template
    btnSave.addEventListener('click', async () => {
        const title = document.getElementById('form-title').value.trim();
        if (!title) {
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please enter a Form Title' });
            return;
        }

        const blocks = document.querySelectorAll('.question-block');
        const schema = [];
        let valid = true;
        
        blocks.forEach(block => {
            const label = block.querySelector('.q-label').value.trim();
            if(!label) valid = false;
            
            const type = block.querySelector('.q-type').value;
            let options = [];
            if(type === 'dropdown' || type === 'radio' || type === 'radiocards') {
                const optString = block.querySelector('.q-options').value;
                options = optString.split(',').map(s => s.trim()).filter(s => s);
            } else if(type === 'info') {
                const infoColor = block.querySelector('.q-info-color').value;
                const contentEl = block.querySelector('.q-info-content');
                const infoContent = contentEl.mde ? contentEl.mde.value() : contentEl.value;
                const infoAccept = block.querySelector('.q-info-accept').checked ? 'true' : 'false';
                options = [infoColor, infoContent, infoAccept];
                
                const btnRows = block.querySelectorAll('.info-btns-list > div');
                btnRows.forEach(row => {
                    const t = row.querySelector('.q-info-btn-text').value.trim();
                    const u = row.querySelector('.q-info-btn-url').value.trim();
                    if (t || u) {
                        options.push(t, u);
                    }
                });
            }
            
            const required = block.querySelector('.q-required').checked;
            schema.push({ label, type, options, required });
        });

        if (!valid || schema.length === 0) {
            Swal.fire({ icon: 'error', title: 'Invalid Form', text: 'Please ensure all questions have labels, and at least one question exists.' });
            return;
        }

        const status = document.getElementById('builder-status');
        btnSave.disabled = true;
        
        const theme = {
            primary: document.getElementById('theme-primary').value,
            bg: document.getElementById('theme-bg').value,
            card: document.getElementById('theme-card').value,
            logoUrl: document.getElementById('form-image-url').value
        };
        const description = document.getElementById('form-description').value;

        const actionType = currentEditTemplateId ? 'update_template' : 'create_template';
        const payload = {
            action: actionType,
            formName: title,
            description: description,
            schema: schema,
            theme: theme
        };
        if (currentEditTemplateId) payload.id = currentEditTemplateId;

        btnSave.textContent = currentEditTemplateId ? 'Updating...' : 'Saving...';
        status.textContent = currentEditTemplateId ? 'Updating Google Spreadsheet Headers...' : 'Generating Google Spreadsheet... This takes a few seconds.';
        status.style.color = 'var(--text-main)';

        try {
            const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: currentEditTemplateId ? 'Form Template updated successfully!' : 'Form Template created! A new Spreadsheet was generated.'
                });
                btnCancel.click();
                fetchTemplates(); // Refresh list
            } else {
                throw new Error(result.message);
            }
        } catch(e) {
            console.error(e);
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--danger)';
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = currentEditTemplateId ? 'Update Form Template' : 'Save Form Template';
        }
    });
});

async function fetchTemplates() {
    const loading = document.getElementById('loading');
    const tableContainer = document.getElementById('table-container');
    const tableBody = document.getElementById('table-body');
    const errorMsg = document.getElementById('error-msg');

    if(GOOGLE_APP_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        loading.style.display = 'none';
        errorMsg.textContent = "Error: Please set your Google Apps Script URL in js/google.js";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_templates' })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            loading.style.display = 'none';
            tableContainer.style.display = 'block';
            
            const data = result.data;
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No templates found. Create one above!</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                
                tr.innerHTML = `
                    <td><strong>${row.formName}</strong><br><small style="color:var(--text-muted)">${row.id}</small></td>
                    <td>
                        <a href="${row.sheetUrl}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;" title="Open Sheet">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/></svg> Sheet
                        </a>
                    </td>
                    <td class="action-btns" style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm btn-view-subs" title="View Submissions">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
                        </button>
                        <button class="btn btn-primary btn-sm btn-fill-form" title="Fill Out Form">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-edit-form" title="Edit Template">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                        </button>
                        <button class="btn btn-primary btn-sm btn-delete-form" style="background-color: var(--danger)" title="Delete Template">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        </button>
                    </td>
                `;
                
                tr.querySelector('.btn-view-subs').addEventListener('click', () => window.viewSubmissions(row.id));
                tr.querySelector('.btn-fill-form').addEventListener('click', () => window.open(`index.html?formId=${row.id}`, '_blank'));
                tr.querySelector('.btn-edit-form').addEventListener('click', () => {
                    const schemaStr = typeof row.schema === 'string' ? row.schema : JSON.stringify(row.schema);
                    const themeStr = typeof row.theme === 'string' ? row.theme : JSON.stringify(row.theme || {});
                    window.editTemplate(row.id, row.formName, row.description || '', schemaStr, themeStr);
                });
                tr.querySelector('.btn-delete-form').addEventListener('click', function() {
                    window.deleteTemplate(row.id, this);
                });
                
                tableBody.appendChild(tr);
            });

        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(error);
        loading.style.display = 'none';
        errorMsg.textContent = "Failed to load templates. See console.";
        errorMsg.style.display = 'block';
    }
}

// Global functions for inline onclick handlers
window.editTemplate = function(id, name, descStr, schemaStr, themeStr) {
    currentEditTemplateId = id;
    
    // Decode schema
    let schema = [];
    try {
        schema = JSON.parse(schemaStr);
    } catch(e) {
        console.error("Failed to parse schema:", e);
    }
    
    // Setup UI
    const listView = document.getElementById('list-view');
    const builderView = document.getElementById('builder-view');
    const questionsContainer = document.getElementById('questions-container');
    const builderTitle = document.querySelector('#builder-view .section-header h3');
    const btnSave = document.getElementById('save-template-btn');
    
    listView.classList.remove('active');
    builderView.classList.add('active');
    questionsContainer.innerHTML = '';
    
    document.getElementById('form-title').value = name;
    builderTitle.textContent = "Edit Form Template";
    btnSave.textContent = "Update Form Template";
    
    schema.forEach(q => {
        window.addQuestionBlock(q.label, q.type, q.options || [], q.required !== false);
    });

    // Decode theme
    let theme = {};
    try { theme = JSON.parse(themeStr); } catch(e){}
    
    document.getElementById('theme-primary').value = theme.primary || '#ef4444';
    document.getElementById('theme-bg').value = theme.bg || '#f8fafc';
    document.getElementById('theme-card').value = theme.card || '#ffffff';
    
    document.getElementById('form-description').value = descStr || '';
};

window.deleteTemplate = async function(id, btnElement) {
    const confirmResult = await Swal.fire({
        title: 'Delete Form Template?',
        text: `Are you sure you want to delete template ${id}? Its Spreadsheet will remain in your Google Drive, but it will be removed from this application.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
    });

    if (!confirmResult.isConfirmed) return;
    
    let originalHTML = '';
    if (btnElement) {
        originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;
        btnElement.disabled = true;
    }

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'delete_template',
                id: id
            })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            Swal.fire('Deleted!', 'Template deleted successfully.', 'success');
            fetchTemplates(); // Refresh table
        } else {
            Swal.fire('Error', 'Error deleting: ' + result.message, 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Network error deleting record.', 'error');
        if (btnElement) {
            btnElement.innerHTML = originalHTML;
            btnElement.disabled = false;
        }
    }
};

let currentSubmissionsData = null;

window.viewSubmissions = async function(id) {
    const modal = document.getElementById('submissions-modal');
    const titleEl = document.getElementById('modal-form-title');
    const idEl = document.getElementById('modal-form-id');
    const loader = document.getElementById('modal-loader');
    const tableContainer = document.getElementById('modal-table-container');
    const tableBody = document.getElementById('modal-table-body');
    const errorEl = document.getElementById('modal-error');
    
    modal.classList.add('active');
    tableContainer.style.display = 'none';
    errorEl.style.display = 'none';
    loader.style.display = 'block';
    titleEl.textContent = 'Form Submissions';
    idEl.textContent = id;
    currentSubmissionsData = null;
    
    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_submissions', id: id })
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            titleEl.textContent = result.data.formName + ' - Submissions';
            currentSubmissionsData = result.data;
            
            loader.style.display = 'none';
            if (result.data.rows.length === 0) {
                errorEl.textContent = "No submissions found for this form yet.";
                errorEl.style.display = 'block';
                return;
            }
            
            tableContainer.style.display = 'block';
            tableBody.innerHTML = '';
            
            result.data.rows.forEach((row, index) => {
                const tr = document.createElement('tr');
                const timestamp = row[0] ? new Date(row[0]).toLocaleString() : 'N/A';
                const subId = row[1] || 'Unknown';
                
                tr.innerHTML = `
                    <td>${timestamp}</td>
                    <td><strong>${subId}</strong></td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm" onclick="window.downloadPdf(${index})" title="Download PDF">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
            
        } else {
            throw new Error(result.message);
        }
    } catch(err) {
        loader.style.display = 'none';
        errorEl.textContent = 'Failed to load submissions: ' + err.message;
        errorEl.style.display = 'block';
    }
};

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        document.getElementById('submissions-modal').classList.remove('active');
    });
}

window.downloadPdf = function(rowIndex) {
    if(!currentSubmissionsData) return;
    
    const rowData = currentSubmissionsData.rows[rowIndex];
    const headers = currentSubmissionsData.headers;
    const formName = currentSubmissionsData.formName;
    const subId = rowData[1] || 'Submission';
    
    const pdfContainer = document.getElementById('pdf-container');
    
    let htmlContent = `
        <style>
            .pdf-wrapper { font-family: 'Inter', 'Noto Sans Sinhala', sans-serif; color: #1f2937; margin: 0; padding: 0; background: #fff; position: relative; }

            .pdf-header { background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 40px; border-radius: 8px 8px 0 0; }
            .pdf-header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
            .pdf-meta { display: flex; justify-content: space-between; font-size: 14px; opacity: 0.9; }
            .pdf-body { padding: 40px; background: #f9fafb; border-radius: 0 0 8px 8px;}
            .pdf-card { background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
            .pdf-table { width: 100%; border-collapse: collapse; font-size: 15px; }
            .pdf-table td { padding: 10px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
            .pdf-table tr:nth-child(even) { background-color: #fdfdfd; }
            .pdf-table tr:last-child td { border-bottom: none; }
            .pdf-q { font-weight: 600; color: #374151; width: 45%; }
            .pdf-a { color: #111827; }
            .pdf-footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; }
        </style>
        <div class="pdf-wrapper">
            <div class="pdf-header">
                <h1>${formName}</h1>
                <div class="pdf-meta">
                    <span><strong>Submission ID:</strong> ${subId}</span>
                    <span><strong>Date:</strong> ${new Date(rowData[0]).toLocaleString()}</span>
                </div>
            </div>
            <div class="pdf-body">
                <div class="pdf-card">
                    <table class="pdf-table">
                        <tbody>
    `;
    
    for(let i=2; i<headers.length; i++) {
        const question = headers[i];
        const answer = rowData[i] || '<em style="color:#9ca3af">No answer provided</em>';
        htmlContent += `
                            <tr>
                                <td class="pdf-q">${question}</td>
                                <td class="pdf-a">${answer}</td>
                            </tr>
        `;
    }
    
    htmlContent += `
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="pdf-footer">
                Generated via AutoCheck Dynamic Forms • ${new Date().toLocaleDateString()}
            </div>
        </div>
    `;
    
    pdfContainer.innerHTML = htmlContent;
    pdfContainer.style.display = 'block';
    
    const opt = {
      margin:       0.5,
      filename:     `${formName}_${subId}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(pdfContainer).save().then(() => {
        pdfContainer.style.display = 'none';
    });
};
