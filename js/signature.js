document.addEventListener('DOMContentLoaded', () => {
    // Setup both signature pads
    setupSignaturePad('customer-sig-pad', 'clear-customer-sig', 'customerSignature');
    setupSignaturePad('inspector-sig-pad', 'clear-inspector-sig', 'inspectorSignature');
});

function setupSignaturePad(canvasId, clearBtnId, hiddenInputId) {
    const canvas = document.getElementById(canvasId);
    const clearBtn = document.getElementById(clearBtnId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const ctx = canvas.getContext('2d');
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Resize canvas to fit container properly, accounting for pixel density
    function resizeCanvas() {
        // Need to set actual width/height to CSS width/height to avoid stretching
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        // height is fixed in CSS to 150px
        
        // Reset ctx properties after resize
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }

    // Call once and on resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse Events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch Events for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = getCoordinates(e);
    }

    function draw(e) {
        if (!isDrawing) return;
        
        const [currentX, currentY] = getCoordinates(e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        [lastX, lastY] = [currentX, currentY];
        
        // Update hidden input with base64 data
        updateDataUrl();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function handleTouchStart(e) {
        e.preventDefault(); // Prevent scrolling while signing
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }

    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];
    }

    function updateDataUrl() {
        hiddenInput.value = canvas.toDataURL('image/png');
    }

    // Clear Button
    clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hiddenInput.value = '';
    });
}
