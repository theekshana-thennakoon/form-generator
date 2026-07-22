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
    let currentStepIndex = 0;
    let stepsData = []; // Array of arrays: each sub-array is a step's fields
    let stepLabels = []; // Array of step titles
    let globalAnswers = {}; // Store answers across steps

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
            
            if (theme.logoUrl) {
                const img = document.getElementById('form-header-image');
                if (img) {
                    img.src = theme.logoUrl;
                    img.style.display = 'block';
                }
            }
            
            // Apply description
            const desc = result.data.description;
            if (desc) {
                const descEl = document.getElementById('form-description-text');
                descEl.textContent = desc;
                descEl.style.display = 'block';
            }
            
            parseSteps(currentSchema);
            renderForm();
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

    function parseSteps(schema) {
        stepsData = [];
        stepLabels = [];
        let currentStepFields = [];
        
        // If first field isn't a step, create a default step
        if (schema.length > 0 && schema[0].type !== 'step') {
            stepLabels.push("General Information");
        }
        
        schema.forEach(q => {
            if (q.type === 'step') {
                if (currentStepFields.length > 0) {
                    stepsData.push(currentStepFields);
                    currentStepFields = [];
                } else if (stepsData.length === 0 && stepLabels.length === 1) {
                    // if they put a step right away but we made a default one, remove default
                    stepLabels = [];
                }
                stepLabels.push(q.label);
            } else {
                currentStepFields.push(q);
            }
        });
        
        if (currentStepFields.length > 0) {
            stepsData.push(currentStepFields);
        }
        if (stepsData.length === 0) stepsData = [[]]; // Fallback
    }

    // Helper: Map keywords to icons for Radio Cards
    function getIconForText(text) {
        const lower = text.toLowerCase();
        if (lower.includes('meet')) return '🤝';
        if (lower.includes('deliver')) return '📦';
        if (lower.includes('audit')) return '🔍';
        if (lower.includes('train')) return '🎓';
        if (lower.includes('interview')) return '👤';
        return '📌';
    }

    function saveCurrentStepAnswers() {
        const formData = new FormData(formEl);
        const fields = stepsData[currentStepIndex] || [];
        
        fields.forEach(q => {
            if (q.type === 'checkbox') {
                globalAnswers[q.label] = formData.has(q.label) ? 'Yes' : 'No';
            } else if (q.type === 'signature') {
                const c = document.querySelector(`canvas[name="${q.label}"]`);
                if (c && c.dataset.hasDrawing === "true") {
                    globalAnswers[q.label] = c.toDataURL('image/png'); // save full res for state
                }
            } else if (q.type === 'selfie') {
                const f = document.querySelector(`.selfie-data[name="${q.label}"]`);
                if (f && f.value) globalAnswers[q.label] = f.value;
            } else if (q.type === 'info') {
                 if (q.options && q.options[2] === 'true') {
                     globalAnswers[q.label] = formData.has(q.label) ? 'Accepted' : '';
                 }
            } else {
                const val = formData.get(q.label);
                if (val !== null) globalAnswers[q.label] = val;
            }
        });
    }

    function renderForm() {
        const container = document.getElementById('form-fields');
        container.innerHTML = '';
        
        // Render Step Nav if > 1 step
        if (stepsData.length > 1) {
            const nav = document.createElement('div');
            nav.className = 'step-nav';
            stepLabels.forEach((label, idx) => {
                const stepEl = document.createElement('div');
                stepEl.className = 'step-item ' + (idx === currentStepIndex ? 'active' : (idx < currentStepIndex ? 'completed' : ''));
                stepEl.innerHTML = `<span class="step-num">${idx + 1}</span> <span class="step-label">${label}</span>`;
                nav.appendChild(stepEl);
            });
            container.appendChild(nav);
        }
        
        const fieldsToRender = stepsData[currentStepIndex] || [];
        
        let currentTableGroup = null;
        let tableTbody = null;
        let currentRadioOptions = null;
        
        fieldsToRender.forEach((q, index) => {
            const isRadioTable = q.type === 'radio';
            
            let optionsMatch = false;
            if (isRadioTable && currentTableGroup && currentRadioOptions) {
                optionsMatch = JSON.stringify(q.options || []) === JSON.stringify(currentRadioOptions);
            }
                            
            if (isRadioTable) {
                if (!currentTableGroup || !optionsMatch) {
                    currentTableGroup = document.createElement('table');
                    currentTableGroup.className = 'checklist-table';
                    currentRadioOptions = q.options || [];
                    
                    let headersHtml = '';
                    currentRadioOptions.forEach(opt => {
                        headersHtml += `<th>${opt.toUpperCase()}</th>`;
                    });

                    currentTableGroup.innerHTML = `
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>DESCRIPTION</th>
                                ${headersHtml}
                            </tr>
                        </thead>
                    `;
                    tableTbody = document.createElement('tbody');
                    currentTableGroup.appendChild(tableTbody);
                    container.appendChild(currentTableGroup);
                }
                
                let tdsHtml = '';
                currentRadioOptions.forEach((opt, i) => {
                    const isChecked = (globalAnswers[q.label] === opt) ? 'checked' : '';
                    tdsHtml += `<td><input type="radio" name="${q.label}" value="${opt}" ${i === 0 ? 'required' : ''} ${isChecked}></td>`;
                });

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="num-col"></td>
                    <td class="desc-col">${q.label}</td>
                    ${tdsHtml}
                `;
                tableTbody.appendChild(tr);
            } else {
                currentTableGroup = null;
                tableTbody = null;
                currentRadioOptions = null;
                
                const group = document.createElement('div');
                group.className = 'dyn-group';
                
                if (q.type === 'info') {
                    const color = (q.options && q.options[0]) ? q.options[0] : 'yellow';
                    let text = '';
                    if (q.options && q.options[1]) {
                        if (typeof marked !== 'undefined') {
                            text = marked.parse(q.options[1]);
                        } else {
                            text = q.options[1].replace(/\n/g, '<br>');
                        }
                    }
                    const requireAccept = (q.options && q.options[2] === 'true');
                    
                    let btnHtml = '';
                    if (q.options && q.options.length > 3) {
                        btnHtml += '<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">';
                        for (let i = 3; i < q.options.length; i += 2) {
                            const btnText = q.options[i];
                            const btnUrl = q.options[i+1];
                            if (btnText || btnUrl) {
                                btnHtml += `<a href="${btnUrl || '#'}" target="_blank" class="btn info-action-btn btn-sm" style="text-decoration:none;">${btnText || 'Link'}</a>`;
                            }
                        }
                        btnHtml += '</div>';
                    }
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'info-block info-' + color;
                    infoDiv.innerHTML = `<strong>${q.label}</strong>${text ? `<div style="margin-top:8px;" class="info-content">${text}</div>` : ''}${btnHtml}`;
                    group.appendChild(infoDiv);
                    
                    if (requireAccept) {
                        const acceptLabel = document.createElement('label');
                        acceptLabel.style.cssText = 'display:flex; align-items:center; gap:12px; cursor:pointer; margin-top:12px; margin-bottom:0;';
                        const isChecked = (globalAnswers[q.label] === 'Accepted') ? 'checked' : '';
                        acceptLabel.innerHTML = `
                            <input type="checkbox" name="${q.label}" value="Accepted" required class="dyn-input info-accept-checkbox" style="width:20px; height:20px; cursor:pointer; margin:0;" ${isChecked}>
                            <strong>Accept and confirm</strong>
                        `;
                        group.appendChild(acceptLabel);
                    }
                } 
                else if (q.type === 'signature') {
                    group.className = 'dyn-group section-card';
                    group.innerHTML = `
                        <label class="section-card-title">${q.label} ${q.required ? '<span style="color:red">*</span>' : ''}</label>
                        <div class="signature-container" style="border: 2px dashed var(--primary); border-radius:12px; background:white; position:relative; overflow:hidden;">
                            <canvas class="signature-pad" name="${q.label}" width="800" height="300" style="width:100%; height:150px; cursor:crosshair; touch-action:none;"></canvas>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="clearSignature(this)">Clear Signature</button>
                    `;
                    setupSignature(group.querySelector('canvas'));
                    
                    if (globalAnswers[q.label]) {
                        const canvas = group.querySelector('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        img.src = globalAnswers[q.label];
                        canvas.dataset.hasDrawing = "true";
                    }
                }
                else if (q.type === 'selfie') {
                    const b64 = globalAnswers[q.label] || '';
                    group.className = 'dyn-group section-card';
                    group.innerHTML = `
                        <label class="section-card-title">${q.label} ${q.required !== false ? '<span style="color:red">*</span>' : ''}</label>
                        <div class="camera-ui" style="display:flex; flex-direction:column; gap:12px; align-items:center; margin-top:8px;">
                            <video class="selfie-video" style="display:${b64 ? 'none' : 'block'}; width:100%; max-width:400px; border-radius:8px; background:#000;" autoplay playsinline></video>
                            <img class="selfie-preview" src="${b64}" style="display:${b64 ? 'block' : 'none'}; width:100%; max-width:400px; border-radius:8px;">
                            <input type="hidden" class="dyn-input selfie-data" name="${q.label}" value="${b64}" ${q.required !== false ? 'required' : ''}>
                            
                            <div class="cam-controls" style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; width:100%;">
                                <button type="button" class="btn btn-secondary btn-open-cam" style="display:${b64 ? 'none' : 'inline-block'};"><span style="font-size:18px;">📷</span> Open Camera</button>
                                <button type="button" class="btn btn-primary btn-take-photo" style="display:none;">Take Photo</button>
                                <button type="button" class="btn btn-secondary btn-retake" style="display:${b64 ? 'inline-block' : 'none'};">Retake</button>
                            </div>
                        </div>
                    `;
                    setupSelfie(group);
                }
                else if (q.type === 'radiocards') {
                    group.className = 'dyn-group section-card';
                    group.innerHTML = `<label class="section-card-title">${q.label} ${q.required !== false ? '<span style="color:red">*</span>' : ''}</label>`;
                    const cardGrid = document.createElement('div');
                    cardGrid.className = 'radio-cards-grid';
                    (q.options || []).forEach((opt, i) => {
                        const lbl = document.createElement('label');
                        lbl.className = 'radio-card';
                        const isChecked = (globalAnswers[q.label] === opt) ? 'checked' : '';
                        lbl.innerHTML = `
                            <input type="radio" name="${q.label}" value="${opt}" ${i===0 && q.required !== false ? 'required' : ''} style="display:none;" ${isChecked}>
                            <div class="card-content">
                                <span class="card-icon">${getIconForText(opt)}</span>
                                <span class="card-text">${opt}</span>
                            </div>
                        `;
                        // add active class handling
                        lbl.querySelector('input').addEventListener('change', (e) => {
                            const siblings = cardGrid.querySelectorAll('.radio-card');
                            siblings.forEach(s => s.classList.remove('active'));
                            if(e.target.checked) lbl.classList.add('active');
                        });
                        cardGrid.appendChild(lbl);
                    });
                    group.appendChild(cardGrid);
                }
                else {
                    group.className = 'dyn-group';
                    const label = document.createElement('label');
                    label.className = 'dyn-label';
                    label.innerHTML = `${q.label} ${q.required !== false ? '<span style="color:red">*</span>' : ''}`;
                    group.appendChild(label);
                    
                    if (q.type === 'text' || q.type === 'date') {
                        const input = document.createElement('input');
                        input.type = q.type;
                        input.className = 'dyn-input';
                        input.name = q.label;
                        input.required = (q.required !== false);
                        group.appendChild(input);
                    } 
                    else if (q.type === 'textarea') {
                        const ta = document.createElement('textarea');
                        ta.className = 'dyn-input';
                        ta.name = q.label;
                        ta.rows = 4;
                        ta.required = (q.required !== false);
                        group.appendChild(ta);
                    }
                    else if (q.type === 'dropdown') {
                        const sel = document.createElement('select');
                        sel.className = 'dyn-input';
                        sel.name = q.label;
                        sel.required = (q.required !== false);
                        
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
                    else if (q.type === 'checkbox') {
                        const cbLabel = document.createElement('label');
                        cbLabel.className = 'radio-label';
                        
                        const cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.name = q.label;
                        cb.value = 'Yes';
                        cb.required = (q.required !== false);
                        
                        cbLabel.appendChild(cb);
                        cbLabel.appendChild(document.createTextNode(' Check to accept'));
                        group.appendChild(cbLabel);
                    }
                }
                
                container.appendChild(group);
            }
        });
        
        // Navigation Buttons
        const navActions = document.createElement('div');
        navActions.className = 'form-actions';
        navActions.style.marginTop = '32px';
        
        if (currentStepIndex > 0) {
            const btnPrev = document.createElement('button');
            btnPrev.type = 'button';
            btnPrev.className = 'btn';
            btnPrev.style.cssText = 'background: transparent; color: var(--text-muted); border: none; text-decoration: underline; padding: 8px 16px; font-size: 14px; box-shadow: none;';
            btnPrev.textContent = 'Back';
            btnPrev.style.marginRight = '16px';
            btnPrev.onclick = () => {
                saveCurrentStepAnswers();
                currentStepIndex--;
                renderForm();
                window.scrollTo(0,0);
            };
            navActions.appendChild(btnPrev);
        }
        
        if (currentStepIndex < stepsData.length - 1) {
            const btnNext = document.createElement('button');
            btnNext.type = 'button';
            btnNext.className = 'btn btn-primary btn-large';
            btnNext.textContent = 'Next';
            btnNext.onclick = () => {
                if (formEl.checkValidity()) {
                    // Check signatures on this page
                    const canvases = container.querySelectorAll('.signature-pad');
                    for (let c of canvases) {
                        if (c.dataset.hasDrawing !== "true") {
                            alert("Please provide all required signatures.");
                            return;
                        }
                    }
                    saveCurrentStepAnswers();
                    currentStepIndex++;
                    renderForm();
                    window.scrollTo(0,0);
                } else {
                    formEl.reportValidity();
                }
            };
            navActions.appendChild(btnNext);
            document.querySelector('.form-actions').style.display = 'none'; // hide main submit
        } else {
            document.querySelector('.form-actions').style.display = 'flex'; // show main submit on last page
        }
        
        container.appendChild(navActions);
        
        // Hide primary action buttons until accept checkboxes are checked
        const acceptCheckboxes = container.querySelectorAll('.info-accept-checkbox');
        if (acceptCheckboxes.length > 0) {
            const primaryBtns = [];
            const nextBtn = navActions.querySelector('.btn-primary');
            if (nextBtn) primaryBtns.push(nextBtn);
            if (currentStepIndex === stepsData.length - 1) primaryBtns.push(document.getElementById('submit-btn'));
            
            const checkAcceptance = () => {
                const allChecked = Array.from(acceptCheckboxes).every(cb => cb.checked);
                primaryBtns.forEach(btn => btn.style.display = allChecked ? 'inline-block' : 'none');
            };
            acceptCheckboxes.forEach(cb => cb.addEventListener('change', checkAcceptance));
            checkAcceptance(); // Initial state
        }
    }
    
    // --- Canvas Signature Logic ---
    function setupSignature(canvas) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        
        // Handle resizing for high DPI / mobile
        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const rect = canvas.getBoundingClientRect();
            // Only resize if it's visible to avoid 0 width
            if (rect.width > 0) {
                canvas.width = rect.width * ratio;
                canvas.height = rect.height * ratio;
                ctx.scale(ratio, ratio);
                // Clear any existing drawing on resize to prevent stretching artifacts
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.dataset.hasDrawing = "false";
            }
        }
        window.addEventListener('resize', resizeCanvas);
        // Call it soon after render
        setTimeout(resizeCanvas, 50);

        function startPosition(e) {
            isDrawing = true;
            draw(e);
        }
        function endPosition() {
            isDrawing = false;
            ctx.beginPath();
        }
        function draw(e) {
            if (!isDrawing) return;
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            let x = e.clientX || (e.touches && e.touches[0].clientX);
            let y = e.clientY || (e.touches && e.touches[0].clientY);
            
            x = x - rect.left;
            y = y - rect.top;

            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';

            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            canvas.dataset.hasDrawing = "true";
        }
        
        canvas.addEventListener('mousedown', startPosition);
        canvas.addEventListener('mouseup', endPosition);
        canvas.addEventListener('mousemove', draw);
        
        canvas.addEventListener('touchstart', startPosition, {passive: false});
        canvas.addEventListener('touchend', endPosition);
        canvas.addEventListener('touchmove', draw, {passive: false});
    }
    
    window.clearSignature = function(btn) {
        const canvas = btn.closest('.dyn-group').querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.dataset.hasDrawing = "false";
        }
    };
    
    // --- Selfie Camera Logic ---
    function setupSelfie(group) {
        const video = group.querySelector('.selfie-video');
        const preview = group.querySelector('.selfie-preview');
        const dataInput = group.querySelector('.selfie-data');
        const btnOpen = group.querySelector('.btn-open-cam');
        const btnTake = group.querySelector('.btn-take-photo');
        const btnRetake = group.querySelector('.btn-retake');
        
        let stream = null;
        
        function stopStream() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        }
        
        btnOpen.addEventListener('click', async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
                video.srcObject = stream;
                video.style.display = 'block';
                preview.style.display = 'none';
                
                btnOpen.style.display = 'none';
                btnTake.style.display = 'inline-block';
                btnRetake.style.display = 'none';
                dataInput.value = ''; // Reset required field
            } catch (err) {
                alert("Camera access denied or unavailable.");
            }
        });
        
        btnTake.addEventListener('click', () => {
            if (!stream) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const b64 = canvas.toDataURL('image/jpeg', 0.6);
            dataInput.value = b64;
            dataInput.dataset.base64 = b64;
            
            preview.src = b64;
            preview.style.display = 'block';
            video.style.display = 'none';
            
            btnTake.style.display = 'none';
            btnRetake.style.display = 'inline-block';
            
            stopStream();
        });
        
        btnRetake.addEventListener('click', () => {
            btnOpen.click();
        });
    }

    // Submit Logic
    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-btn');
        const status = document.getElementById('submit-status');
        
        // Validate signatures on final submit
        const canvases = document.querySelectorAll('.signature-pad');
        for (let c of canvases) {
            if (c.dataset.hasDrawing !== "true") {
                alert("Please provide all required signatures.");
                return;
            }
        }
        
        if(btn) {
            btn.disabled = true;
            btn.textContent = 'Submitting...';
        }
        if(status) status.textContent = '';
        
        // Save final step answers
        saveCurrentStepAnswers();
        
        // When submitting, use the global answers but compress signatures
        const finalAnswers = {};
        
        currentSchema.forEach(q => {
            if (q.type === 'step') return;
            
            if (q.type === 'signature') {
                const b64 = globalAnswers[q.label];
                if (b64) {
                    const img = new Image();
                    img.onload = async () => {
                        const destCanvas = document.createElement('canvas');
                        destCanvas.width = 300; destCanvas.height = 100;
                        const destCtx = destCanvas.getContext('2d');
                        destCtx.drawImage(img, 0, 0, destCanvas.width, destCanvas.height);
                        finalAnswers[q.label] = destCanvas.toDataURL('image/png', 0.5);
                        
                        // Proceed to fetch ONLY after all signatures are processed
                        // For simplicity in a sync-like flow, we do this here. 
                        // But wait, onload is async. 
                    };
                    img.src = b64;
                    // Note: To avoid complex async, let's just compress it synchronously by grabbing the canvas if it exists, 
                    // or storing the compressed version in globalAnswers initially alongside the full one.
                }
            }
        });

        // Better synchronous signature compression:
        Object.keys(globalAnswers).forEach(key => {
            const q = currentSchema.find(x => x.label === key);
            if (q && q.type === 'signature' && globalAnswers[key]) {
                 // We will compress it inline
                 const c = document.querySelector(`canvas[name="${key}"]`);
                 if (c) {
                     const destCanvas = document.createElement('canvas');
                     destCanvas.width = 300; destCanvas.height = 100;
                     const destCtx = destCanvas.getContext('2d');
                     destCtx.drawImage(c, 0, 0, destCanvas.width, destCanvas.height);
                     finalAnswers[key] = destCanvas.toDataURL('image/png', 0.5);
                 } else {
                     finalAnswers[key] = globalAnswers[key]; // fallback to full res if canvas is gone
                 }
            } else {
                finalAnswers[key] = globalAnswers[key];
            }
        });

        try {
            const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'submit_dynamic',
                    id: formId,
                    answers: finalAnswers
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
            if(status) {
                status.textContent = 'Error: ' + err.message;
                status.style.color = 'var(--danger)';
            }
            if(btn) {
                btn.disabled = false;
                btn.textContent = 'Accept and confirm';
            }
        }
    });
});
