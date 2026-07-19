// TODO: User must replace this URL with their deployed Google Apps Script Web App URL
const GOOGLE_APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxg7ZQVIJtEq5TVhwfljbbFpNiHxrGJFQSZjJmd5ygZziEHYvo0LvzJc1YHMx7BESu-/exec';

let currentEditId = null;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inspection-form');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('save-status');

    // Check if we are in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
        currentEditId = editId;
        saveBtn.textContent = 'Update Inspection';
        loadRecordForEditing(editId);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (GOOGLE_APP_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            statusMsg.textContent = "Error: Please set your Google Apps Script URL in js/google.js";
            statusMsg.className = "status-error";
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = currentEditId ? 'Updating...' : 'Saving...';
        statusMsg.textContent = '';
        statusMsg.className = '';

        try {
            const formData = compileFormData();
            const payload = {
                action: currentEditId ? 'update' : 'create',
                id: currentEditId, // will be null if creating
                data: formData
            };

            const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok || response.type === 'opaque') {
                statusMsg.textContent = currentEditId ? 'Inspection updated successfully!' : 'Inspection saved successfully!';
                statusMsg.className = 'status-success';

                if (!currentEditId) {
                    form.reset();
                    // Clear signatures and damage map
                    document.getElementById('clear-damage').click();
                    document.getElementById('clear-customer-sig').click();
                    document.getElementById('clear-inspector-sig').click();
                } else {
                    // Redirect back to admin panel after update
                    setTimeout(() => {
                        // Redirect to Admin Panel on success
                        window.location.href = 'admin';
                    }, 1500);
                }
            } else {
                throw new Error('Network response was not ok');
            }

        } catch (error) {
            console.error('Submission error:', error);
            statusMsg.textContent = 'Error saving data. Check console.';
            statusMsg.className = 'status-error';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = currentEditId ? 'Update Inspection' : 'Save Inspection';
        }
    });

    function compileFormData() {
        const formData = new FormData(form);

        const data = {
            vehicle: formData.get('vehicleNo'),
            brand: formData.get('brand'),
            model: formData.get('model'),
            vin: formData.get('vin'),
            engineNo: formData.get('engineNo'),
            odometer: formData.get('odometer'),
            fuel: formData.get('fuelLevel'),
            date: formData.get('date'),
            inspectorName: formData.get('inspectorName'),
            notes: formData.get('notes'),
            customerSignature: formData.get('customerSignature'),
            inspectorSignature: formData.get('inspectorSignature'),
            damage: JSON.parse(document.getElementById('damageData').value || '[]'),
            exterior: gatherChecklistData('exterior'),
            interior: gatherChecklistData('interior'),
            engine: gatherChecklistData('engine'),
            accessories: gatherChecklistData('accessories'),
            tyres: gatherTyreData()
        };

        return data;
    }

    function gatherChecklistData(category) {
        const result = {};
        if (window.checklists && window.checklists[category]) {
            window.checklists[category].forEach(item => {
                const safeId = item.toLowerCase().replace(/\s+/g, '-');
                const name = `${category}_${safeId}`;

                const cb = document.getElementById(`cb_${name}`);
                const isChecked = cb ? cb.checked : false;

                const radioNode = document.querySelector(`input[name="cond_${name}"]:checked`);
                const condition = radioNode ? radioNode.value : 'Not specified';

                result[item] = {
                    inspected: isChecked,
                    condition: condition
                };
            });
        }
        return result;
    }

    function gatherTyreData() {
        const positions = ['lf', 'rf', 'lr', 'rr'];
        const result = {};

        positions.forEach(pos => {
            const container = document.getElementById(`tyre-${pos}`);
            if (container) {
                result[pos.toUpperCase()] = {
                    brand: container.querySelector('.tyre-brand').value,
                    pressure: container.querySelector('.tyre-pressure').value,
                    tread: container.querySelector('.tyre-tread').value,
                    condition: container.querySelector('.tyre-condition').value
                };
            }
        });

        return result;
    }

    async function loadRecordForEditing(id) {
        const statusMsg = document.getElementById('save-status');
        statusMsg.textContent = 'Loading record...';

        try {
            const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'read_one', id: id })
            });
            const result = await response.json();

            if (result.status === 'success') {
                statusMsg.textContent = '';
                populateForm(result.data);
            } else {
                statusMsg.textContent = 'Error loading record: ' + result.message;
                statusMsg.className = 'status-error';
            }
        } catch (error) {
            console.error(error);
            statusMsg.textContent = 'Failed to load record from server.';
            statusMsg.className = 'status-error';
        }
    }

    function populateForm(data) {
        // Basic inputs
        const fields = ['vehicleNo', 'brand', 'model', 'vin', 'engineNo', 'odometer', 'fuelLevel', 'inspectorName', 'notes'];

        // Mappings from Google Sheet keys to our form IDs
        const mappings = {
            'vehicleNo': 'vehicleNo',
            'brand': 'brand',
            'model': 'model',
            'vin': 'vin',
            'engineNo': 'engineNo',
            'odometer': 'odometer',
            'fuel': 'fuelLevel',
            'inspectorName': 'inspectorName',
            'notes': 'notes'
        };

        for (let key in mappings) {
            let el = document.getElementById(mappings[key]);
            if (el && data[key]) {
                el.value = data[key];
            }
        }

        // Date (needs to be YYYY-MM-DD for input type="date")
        if (data.date) {
            try {
                const d = new Date(data.date);
                document.getElementById('date').value = d.toISOString().split('T')[0];
            } catch (e) { }
        }

        // Tyres
        if (data.tyres) {
            try {
                const tyres = JSON.parse(data.tyres);
                const positions = ['lf', 'rf', 'lr', 'rr'];
                positions.forEach(pos => {
                    const posKey = pos.toUpperCase();
                    if (tyres[posKey]) {
                        const container = document.getElementById(`tyre-${pos}`);
                        if (container) {
                            container.querySelector('.tyre-brand').value = tyres[posKey].brand || '';
                            container.querySelector('.tyre-pressure').value = tyres[posKey].pressure || '';
                            container.querySelector('.tyre-tread').value = tyres[posKey].tread || '';
                            container.querySelector('.tyre-condition').value = tyres[posKey].condition || 'Good';
                        }
                    }
                });
            } catch (e) { }
        }

        // Checklists
        const categories = ['exterior', 'interior', 'engine', 'accessories'];
        categories.forEach(cat => {
            if (data[cat]) {
                try {
                    const parsed = JSON.parse(data[cat]);
                    for (let item in parsed) {
                        const safeId = item.toLowerCase().replace(/\s+/g, '-');
                        const name = `${cat}_${safeId}`;

                        // Checkbox
                        const cb = document.getElementById(`cb_${name}`);
                        if (cb) cb.checked = parsed[item].inspected;

                        // Radio
                        const radios = document.getElementsByName(`cond_${name}`);
                        radios.forEach(r => {
                            if (r.value === parsed[item].condition) r.checked = true;
                        });
                    }
                } catch (e) { }
            }
        });

        // We skip repopulating signatures and damage diagrams on the canvas for V1 simplicity,
        // though we could redraw markers if desired. For now, they can be left as is or re-done.
    }
});
