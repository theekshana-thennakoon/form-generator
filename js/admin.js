document.addEventListener('DOMContentLoaded', () => {
    fetchInspections();
});

async function fetchInspections() {
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
            body: JSON.stringify({ action: 'read_all' })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            loading.style.display = 'none';
            tableContainer.style.display = 'block';
            
            const data = result.data;
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No inspections found.</td></tr>';
                return;
            }

            tableBody.innerHTML = ''; // Clear
            data.forEach(row => {
                const tr = document.createElement('tr');
                const formName = `${row.vehicleNo || 'Unknown Vehicle'} - ${row.brand || ''} ${row.model || ''} (${formatDate(row.date)})`;
                
                tr.innerHTML = `
                    <td><strong>${formName}</strong></td>
                    <td><a href="${row.sheetLink}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">Open in Sheets ↗</a></td>
                    <td class="action-btns">
                        <button class="btn btn-secondary btn-sm" onclick="editInspection('${row.id}')">Edit</button>
                        <button class="btn btn-primary btn-sm" style="background-color: var(--danger)" onclick="deleteInspection('${row.id}')">Remove</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(error);
        loading.style.display = 'none';
        errorMsg.textContent = "Failed to load data. See console.";
        errorMsg.style.display = 'block';
    }
}

function formatDate(dateStr) {
    if(!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString();
    } catch(e) {
        return dateStr;
    }
}

function editInspection(id) {
    if (!id || id === 'N/A') {
        Swal.fire('Error', 'Cannot edit: This row does not have a unique ID.', 'error');
        return;
    }
    // Redirect to index.html in edit mode
    window.location.href = `index.html?edit=${id}`;
}

async function deleteInspection(id) {
    if (!id || id === 'N/A') {
        Swal.fire('Error', 'Cannot delete: This row does not have a unique ID.', 'error');
        return;
    }
    
    const confirmResult = await Swal.fire({
        title: 'Are you sure?',
        text: `Are you sure you want to delete inspection ${id}? This cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!'
    });

    if (!confirmResult.isConfirmed) {
        return;
    }

    try {
        const response = await fetch(GOOGLE_APP_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'delete',
                id: id
            })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            Swal.fire('Deleted!', 'Deleted successfully.', 'success');
            fetchInspections(); // Refresh table
        } else {
            Swal.fire('Error', 'Error deleting: ' + result.message, 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Network error deleting record.', 'error');
    }
}
