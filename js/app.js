document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('formId');
    
    const loadingView = document.getElementById('loading-view');
    const errorView = document.getElementById('error-view');
    const errorText = document.getElementById('error-text');
    const formEl = document.getElementById('dynamic-form');
    
    if (!formId) {
        loadingView.style.display = 'none';
        errorText.textContent = "No Form ID provided in URL. Please use the link from the Admin panel.";
        errorView.style.display = 'block';
        return;
    }

    if(GOOGLE_APP_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        loadingView.style.display = 'none';
        errorText.textContent = "Error: Please set your Google Apps Script URL in js/google.js";
        errorView.style.display = 'block';
        return;
    }

    let currentSchema = null;

    // Fetch the template schema
    fetch(GOOGLE_APP_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'get_template', id: formId })
    })
    .then(res => res.json())
    .then(result => {
        if (result.status === 'success') {
            currentSchema = result.data.schema;
            document.getElementById('form-title').textContent = result.data.formName;
            
            // Apply custom theme if available
            const theme = result.data.theme || {};
            if (theme.primary) document.documentElement.style.setProperty('--primary', theme.primary);
            if (theme.bg) document.documentElement.style.setProperty('--background', theme.bg);
            if (theme.card) document.documentElement.style.setProperty('--card-bg', theme.card);
            
            // Apply description
            const desc = result.data.description;
            if (desc) {
                const descEl = document.getElementById('form-description-text');
                descEl.textContent = desc;
                descEl.style.display = 'block';
            }
            
            renderForm(currentSchema);
            loadingView.style.display = 'none';
            formEl.style.display = 'block';
        } else {
            throw new Error(result.message);
        }
    })
    .catch(err => {
        loadingView.style.display = 'none';
        errorText.textContent = err.message || "Failed to load form template.";
        errorView.style.display = 'block';
    });

    // Render HTML inputs based on schema
    function renderForm(schema) {
        const container = document.getElementById('form-fields');
        container.innerHTML = '';
        
        schema.forEach((q, index) => {
            const safeName = `q_${index}`;
            const group = document.createElement('div');
            group.className = 'dyn-group';
            
            const label = document.createElement('label');
            label.className = 'dyn-label';
            label.textContent = q.label;
            group.appendChild(label);
            
            if (q.type === 'text' || q.type === 'date') {
                const input = document.createElement('input');
                input.type = q.type;
                input.className = 'dyn-input';
                input.name = q.label; // Use label directly as key for backend mapping
                input.required = true;
                group.appendChild(input);
            } 
            else if (q.type === 'textarea') {
                const ta = document.createElement('textarea');
                ta.className = 'dyn-input';
                ta.name = q.label;
                ta.rows = 4;
                group.appendChild(ta);
            }
            else if (q.type === 'dropdown') {
                const sel = document.createElement('select');
                sel.className = 'dyn-input';
                sel.name = q.label;
                
                const def = document.createElement('option');
                def.value = '';
                def.textContent = 'Select an option...';
                def.disabled = true;
                def.selected = true;
                sel.appendChild(def);
                
                (q.options || []).forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt;
                    o.textContent = opt;
                    sel.appendChild(o);
                });
                group.appendChild(sel);
            }
            else if (q.type === 'radio') {
                const rg = document.createElement('div');
                rg.className = 'radio-group';
                (q.options || []).forEach((opt, i) => {
                    const rLabel = document.createElement('label');
                    rLabel.className = 'radio-label';
                    
                    const rInput = document.createElement('input');
                    rInput.type = 'radio';
                    rInput.name = q.label; // Radio group shares the name
                    rInput.value = opt;
                    if(i===0) rInput.required = true; // Make at least one required for validation
                    
                    rLabel.appendChild(rInput);
                    rLabel.appendChild(document.createTextNode(' ' + opt));
                    rg.appendChild(rLabel);
                });
                group.appendChild(rg);
            }
            else if (q.type === 'checkbox') {
                const cbLabel = document.createElement('label');
                cbLabel.className = 'radio-label';
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.name = q.label;
                cb.value = 'Yes'; // If checked, value is Yes, else it will be missing from FormData
                
                cbLabel.appendChild(cb);
                cbLabel.appendChild(document.createTextNode(' Check if applicable'));
                group.appendChild(cbLabel);
            }
            
            container.appendChild(group);
        });
    }

    // Submit Logic
    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const status = document.getElementById('submit-status');
        
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        status.textContent = '';
        
        // Gather answers mapped by the question Label
        const formData = new FormData(formEl);
        const answers = {};
        
        currentSchema.forEach(q => {
            if (q.type === 'checkbox') {
                // Checkboxes only exist in FormData if checked
                answers[q.label] = formData.has(q.label) ? 'Yes' : 'No';
            } else {
                answers[q.label] = formData.get(q.label) || '';
            }
        });

        try {
            const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'submit_dynamic',
                    id: formId,
                    answers: answers
                })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                formEl.style.display = 'none';
                document.getElementById('success-view').style.display = 'block';
            } else {
                throw new Error(result.message);
            }
        } catch(err) {
            console.error(err);
            status.textContent = 'Error: ' + err.message;
            status.style.color = 'var(--danger)';
            btn.disabled = false;
            btn.textContent = 'Submit Response';
        }
    });
});
