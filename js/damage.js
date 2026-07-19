document.addEventListener('DOMContentLoaded', () => {
    const tools = document.querySelectorAll('.tool-btn:not(.clear-btn)');
    const clearBtn = document.getElementById('clear-damage');
    const diagramArea = document.getElementById('diagram-area');
    const markersContainer = document.getElementById('markers-container');
    const damageDataInput = document.getElementById('damageData');
    
    let currentTool = 'dent'; // Default
    let markers = [];

    // Tool selection
    tools.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tools.forEach(t => t.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');
            currentTool = btn.dataset.type;
        });
    });

    // Diagram click to add marker
    diagramArea.addEventListener('click', (e) => {
        // Only trigger if clicking on the area itself or the image, not a marker
        if (e.target.classList.contains('damage-marker')) return;

        const rect = diagramArea.getBoundingClientRect();
        
        // Calculate percentages so it scales on mobile
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        addMarker(xPercent, yPercent, currentTool);
    });

    // Clear all markers
    clearBtn.addEventListener('click', () => {
        markersContainer.innerHTML = '';
        markers = [];
        updateHiddenInput();
    });

    function addMarker(x, y, type) {
        const marker = document.createElement('div');
        marker.className = `damage-marker ${type}`;
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        
        // Define icons based on user requirements
        const icons = {
            'dent': '●',
            'scratch': '▲',
            'crack': '■'
        };
        marker.textContent = icons[type];
        
        // Allow removing individual markers
        marker.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent diagram click
            marker.remove();
            
            // Remove from array based on coordinate match (approx)
            markers = markers.filter(m => m.x !== x && m.y !== y);
            updateHiddenInput();
        });

        markersContainer.appendChild(marker);
        
        // Save to array
        markers.push({ x, y, type });
        updateHiddenInput();
    }

    function updateHiddenInput() {
        damageDataInput.value = JSON.stringify(markers);
    }
});
