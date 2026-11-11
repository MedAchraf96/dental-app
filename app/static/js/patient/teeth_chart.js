document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('teeth-chart-container');
    if (!container) return;

    const patientId = container.getAttribute('data-patient-id');
    const csrfToken = container.getAttribute('data-csrf-token');
    const treatmentsUrl = container.getAttribute('data-treatments-url');
    const statusBar = document.getElementById('status-bar');
    const linesGroup = document.getElementById('prosthetic-lines');

    let savedStates = {};
    let savedProsthetics = [];
    let currentTool = 'healthy';
    let rangeStartTooth = null;

    // Load both teeth states and prosthetics
    Promise.all([
        fetch(`/patients/${patientId}/api/teeth-chart`).then(r => r.json()),
        fetch(`/patients/${patientId}/api/prosthetics`).then(r => r.json())
    ]).then(([states, prosthetics]) => {
        savedStates = states;
        savedProsthetics = prosthetics;
        initChart();
    }).catch(err => {
        console.error("Load error:", err);
        initChart();
    });

    function initChart() {
        // 1. CREATE THE DENTURE BASE LAYER (Behind the teeth)
        let basesGroup = document.getElementById('denture-bases');
        if (!basesGroup) {
            basesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            basesGroup.setAttribute('id', 'denture-bases');
            // Insert it BEFORE the teeth so it renders behind them
            const spotsGroup = document.querySelector('#Spots');
            if (spotsGroup && spotsGroup.parentNode) {
                spotsGroup.parentNode.insertBefore(basesGroup, spotsGroup);
            }
        }

        const spots = document.querySelectorAll('.spots polygon, .spots path');
        if (spots.length === 0) return;

        spots.forEach(spot => {
            const key = spot.getAttribute('data-key');
            const state = savedStates[key] || 'healthy';
            spot.setAttribute('data-state', state);
            spot.classList.add(`tooth-state-${state}`);
            updateLabel(key, state);
            attachToothEvents(spot);
        });

        drawAllProsthetics();
        updateSummary();
    }

    function attachToothEvents(spot) {
        spot.addEventListener('mouseover', () => {
            const key = spot.getAttribute('data-key');
            const state = spot.getAttribute('data-state') || 'healthy';
            statusBar.innerHTML = `Tooth <span class="highlight">#${key}</span> — ${state.toUpperCase()}`;

            if ((currentTool === 'bridge' || currentTool === 'partial' || currentTool === 'implant_bridge') && rangeStartTooth) {
                spot.classList.add('tooth-selected');
            }
        });

        spot.addEventListener('mouseout', () => {
            spot.classList.remove('tooth-selected');
            statusBar.innerHTML = rangeStartTooth ? `Start: #${rangeStartTooth}. Click End Tooth...` : 'Select a tool...';
        });

        spot.addEventListener('click', () => handleToothClick(spot));
    }

    function handleToothClick(spot) {
        const key = spot.getAttribute('data-key');

        // RANGE TOOLS
        if (currentTool === 'bridge' || currentTool === 'partial' || currentTool === 'implant_bridge') {
            if (!rangeStartTooth) {
                rangeStartTooth = key;
                spot.classList.add('tooth-selected');
                statusBar.innerHTML = `Start: #${key}. Click End Tooth...`;
            } else {
                saveProsthetic(currentTool, rangeStartTooth, key);
                document.querySelectorAll('.tooth-selected').forEach(el => el.classList.remove('tooth-selected'));
                rangeStartTooth = null;
                statusBar.innerHTML = 'Saved! Select next range...';
            }
            return;
        }

        // SINGLE TOOLS
        if (rangeStartTooth) {
            rangeStartTooth = null;
            document.querySelectorAll('.tooth-selected').forEach(el => el.classList.remove('tooth-selected'));
        }

        const newState = currentTool;
        const oldState = spot.getAttribute('data-state');
        if (oldState === newState) return;

        spot.setAttribute('data-state', newState);
        spot.className.baseVal = '';
        spot.classList.add(`tooth-state-${newState}`);
        updateLabel(key, newState);

        savedStates[key] = newState;
        saveToDatabase(key, newState);
        updateSummary();
    }

    // 🧠 THE ONE AND ONLY saveProsthetic FUNCTION (With Smart Crown Conversion)
    function saveProsthetic(requestedType, start, end) {
        let finalType = requestedType;
        const startState = savedStates[start] || 'healthy';
        const endState = savedStates[end] || 'healthy';

        // Smart Detection Logic
        if (requestedType === 'bridge') {
            if (startState === 'implant' || endState === 'implant') {
                finalType = 'implant_bridge';
                statusBar.innerHTML = `Detected Implant! Saved as <span class="highlight">Implant Bridge</span>.`;
            } else {
                finalType = 'bridge';
                statusBar.innerHTML = `Saved as <span class="highlight">Tooth-Supported Bridge</span>.`;
            }
        } else if (requestedType === 'partial') {
            finalType = 'partial';
            statusBar.innerHTML = `Saved as <span class="highlight">Partial Denture</span>.`;
        }

        // 🦷 Smart Crown Conversion
        const teethInRange = getTeethInRange(start, end);
        teethInRange.forEach(toothNum => {
            const currentState = savedStates[toothNum] || 'healthy';

            // Convert to crown if: NOT an implant, NOT missing, and NOT a partial denture
            if (finalType !== 'partial' && currentState !== 'implant' && currentState !== 'missing') {
                savedStates[toothNum] = 'crown';

                const spot = document.querySelector(`.spots [data-key="${toothNum}"]`);
                if (spot) {
                    spot.setAttribute('data-state', 'crown');
                    spot.className.baseVal = '';
                    spot.classList.add('tooth-state-crown');
                    updateLabel(toothNum, 'crown');
                }
                saveToDatabase(toothNum, 'crown');
            }
        });

        // Save to database
        fetch(`/patients/${patientId}/api/prosthetics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ type: finalType, start, end })
        }).then(r => r.json()).then(data => {
            savedProsthetics.push({ id: data.id, type: finalType, start, end });
            drawAllProsthetics(); // <-- CHANGE THIS (was: drawProsthetic(...))
            updateSummary();
        }).catch(err => console.error("Save prosthetic error:", err));
    }

    function getToothCenter(key) {
        const spot = document.querySelector(`.spots [data-key="${key}"]`);
        if (!spot) return null;
        const bbox = spot.getBBox();
        return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    }

    function drawAllProsthetics() {
        if (linesGroup) linesGroup.innerHTML = '';
        savedProsthetics.forEach(drawProsthetic);
        drawDentureBases(); // Draws the acrylic base behind bilateral partials
    }

    function drawDentureBases() {
        const basesGroup = document.getElementById('denture-bases');
        if (!basesGroup) return;
        basesGroup.innerHTML = '';

        const drawConnector = (partials, archType) => {
            if (partials.length < 2) return;

            // 1. Process each partial to find its leftmost and rightmost teeth
            let processedPartials = partials.map(p => {
                const teeth = getTeethInRange(p.start, p.end);
                const points = teeth.map(t => ({ key: t, center: getToothCenter(t) })).filter(pt => pt.center);

                // Sort teeth in this partial from left to right
                points.sort((a, b) => a.center.x - b.center.x);

                return {
                    leftTooth: points[0],
                    rightTooth: points[points.length - 1]
                };
            });

            // 2. Sort the PARTIALS themselves from left to right based on their leftmost tooth
            processedPartials.sort((a, b) => a.leftTooth.center.x - b.leftTooth.center.x);

            // 3. Connect adjacent partials
            for (let i = 0; i < processedPartials.length - 1; i++) {
                const currentPartial = processedPartials[i];
                const nextPartial = processedPartials[i + 1];

                // Connect the RIGHT side of the current partial to the LEFT side of the next
                const pt1 = currentPartial.rightTooth.center;
                const pt2 = nextPartial.leftTooth.center;

                if (!pt1 || !pt2) continue;

                // Calculate control point exactly between the two teeth
                const midX = (pt1.x + pt2.x) / 2;
                const midY = (pt1.y + pt2.y) / 2;

                // Bow INWARD (toward the tongue/palate)
                let controlY = midY;
                if (archType === 'lower') {
                    controlY -= 100; // Bow UP for lower arch
                } else {
                    controlY += 100; // Bow DOWN for upper arch
                }

                const pathD = `M ${pt1.x} ${pt1.y} Q ${midX} ${controlY} ${pt2.x} ${pt2.y}`;

                // Draw thick acrylic base
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathD);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', '#00bcd4');
                path.setAttribute('stroke-width', '25');
                path.setAttribute('opacity', '0.3');
                path.setAttribute('stroke-linecap', 'round');
                basesGroup.appendChild(path);

                // Draw thin metal framework line
                const metalLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                metalLine.setAttribute('d', pathD);
                metalLine.setAttribute('fill', 'none');
                metalLine.setAttribute('stroke', '#006064');
                metalLine.setAttribute('stroke-width', '4');
                metalLine.setAttribute('opacity', '0.7');
                metalLine.setAttribute('stroke-linecap', 'round');
                basesGroup.appendChild(metalLine);
            }
        };

        // Check for LOWER arch partials
        const lowerPartials = savedProsthetics.filter(p => {
            if (p.type !== 'partial') return false;
            const teeth = getTeethInRange(p.start, p.end);
            return teeth.some(t => parseInt(t) >= 31 && parseInt(t) <= 48);
        });
        drawConnector(lowerPartials, 'lower');

        // Check for UPPER arch partials
        const upperPartials = savedProsthetics.filter(p => {
            if (p.type !== 'partial') return false;
            const teeth = getTeethInRange(p.start, p.end);
            return teeth.some(t => parseInt(t) >= 11 && parseInt(t) <= 28);
        });
        drawConnector(upperPartials, 'upper');
    }

    function saveToDatabase(toothNumber, state) {
        fetch(`/patients/${patientId}/api/teeth-chart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ tooth_number: toothNumber, state: state })
        }).catch(err => console.error(err));
    }

    function resetChart() {
        if (!confirm('Reset ALL teeth and prosthetics?')) return;

        Promise.all([
            fetch(`/patients/${patientId}/api/teeth-chart`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrfToken }
            }),
            fetch(`/patients/${patientId}/api/prosthetics`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrfToken }
            })
        ]).then(() => location.reload());
    }

    // Tool selection
    document.querySelectorAll('.state-btn, .tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.state-btn, .tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.dataset.state) currentTool = btn.dataset.state;
            else if (btn.dataset.type) currentTool = btn.dataset.type;

            rangeStartTooth = null;
            document.querySelectorAll('.tooth-selected').forEach(el => el.classList.remove('tooth-selected'));
            statusBar.innerHTML = `Tool: ${btn.textContent.trim()}`;
        });
    });

    document.getElementById('reset-chart-btn').addEventListener('click', resetChart);

    document.getElementById('recap-card').addEventListener('click', (e) => {
        const toothNum = e.target.closest('.tooth-num');
        if (toothNum && toothNum.dataset.tooth) {
            window.location.href = `${treatmentsUrl}?tooth=${toothNum.dataset.tooth}`;
        }
    });

    function getTeethInRange(start, end) {
        const upperArch = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
        const lowerArch = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

        let arch = upperArch.includes(start) ? upperArch : lowerArch;
        let startIndex = arch.indexOf(start);
        let endIndex = arch.indexOf(end);

        if (startIndex === -1 || endIndex === -1) return [start, end];

        if (startIndex <= endIndex) {
            return arch.slice(startIndex, endIndex + 1);
        } else {
            return arch.slice(endIndex, startIndex + 1).reverse();
        }
    }

    function drawProsthetic(p) {
        const teethInRange = getTeethInRange(p.start, p.end);
        if (teethInRange.length < 2) return;

        let color, width;
        if (p.type === 'bridge') { color = '#fbc02d'; width = 12; }
        else if (p.type === 'partial') { color = '#00bcd4'; width = 8; }
        else if (p.type === 'implant_bridge') { color = '#9c27b0'; width = 10; }

        for (let i = 0; i < teethInRange.length - 1; i++) {
            const startPt = getToothCenter(teethInRange[i]);
            const endPt = getToothCenter(teethInRange[i + 1]);
            if (!startPt || !endPt) continue;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', startPt.x); line.setAttribute('y1', startPt.y);
            line.setAttribute('x2', endPt.x); line.setAttribute('y2', endPt.y);
            line.setAttribute('stroke', color); line.setAttribute('stroke-width', width);
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('opacity', '0.85');
            linesGroup.appendChild(line);
        }

        const firstTooth = getToothCenter(teethInRange[0]);
        const lastTooth = getToothCenter(teethInRange[teethInRange.length - 1]);

        if (p.type === 'partial' && firstTooth && lastTooth) {
            [firstTooth, lastTooth].forEach(pt => {
                const hook = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                hook.setAttribute('cx', pt.x); hook.setAttribute('cy', pt.y);
                hook.setAttribute('r', 6); hook.setAttribute('fill', '#00838f');
                linesGroup.appendChild(hook);
            });
        } else if (p.type === 'implant_bridge' && firstTooth && lastTooth) {
            [firstTooth, lastTooth].forEach(pt => {
                const screw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                screw.setAttribute('x', pt.x - 5); screw.setAttribute('y', pt.y - 5);
                screw.setAttribute('width', 10); screw.setAttribute('height', 10);
                screw.setAttribute('fill', '#4a148c');
                screw.setAttribute('rx', 2);
                linesGroup.appendChild(screw);

                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
                dot.setAttribute('r', 2); dot.setAttribute('fill', '#ffffff');
                linesGroup.appendChild(dot);
            });
        }
    }

    function updateSummary() {
        const groups = {
            decayed: [], filled: [], missing: [], implant: [], crown: [],
            bridge: [], partial: [], implant_bridge: []
        };

        Object.entries(savedStates).forEach(([key, state]) => {
            if (state !== 'healthy' && groups[state]) groups[state].push(key);
        });

        savedProsthetics.forEach(p => {
            groups[p.type].push(p);
        });

        let html = '';

        const singleStates = [
            { type: 'decayed', label: 'DECAYED', color: '#ff4d4d' },
            { type: 'filled', label: 'FILLED', color: '#4d94ff' },
            { type: 'missing', label: 'MISSING', color: '#212529' },
            { type: 'crown', label: 'CROWN', color: '#ffd700' },
            { type: 'implant', label: 'IMPLANT', color: '#9c27b0' }
        ];

        singleStates.forEach(({ type, label, color }) => {
            if (groups[type].length > 0) {
                html += `<div style="margin-top: 15px;">
        <div style="font-size: 12px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
            ${label} (${groups[type].length})
        </div>
        <div class="tooth-list">
            ${groups[type].map(t => `<span class="tooth-num ${type}" data-tooth="${t}" style="cursor: pointer;">#${t}</span>`).join(', ')}
        </div>
        </div>`;
            }
        });

        const prostheticTypes = [
            { type: 'bridge', label: 'BRIDGES', color: '#fbc02d', icon: '🔗' },
            { type: 'partial', label: 'PARTIALS', color: '#00bcd4', icon: '🔗' },
            { type: 'implant_bridge', label: 'IMPLANT BRIDGES', color: '#9c27b0', icon: '🔗' }
        ];

        prostheticTypes.forEach(({ type, label, color, icon }) => {
            if (groups[type].length > 0) {
                html += `<div style="margin-top: 15px;">
        <div style="font-size: 12px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
            ${icon} ${label} (${groups[type].length})
        </div>
        <div class="tooth-list">
            ${groups[type].map(p => {
                    const teeth = getTeethInRange(p.start, p.end);
                    const range = teeth.map(t => `#${t}`).join(' → ');
                    return `<div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span class="tooth-num" style="color: ${color}; font-size: 12px;">${range}</span>
                <button class="delete-prosthetic-btn" data-prosthetic-id="${p.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; padding: 0 5px;">×</button>
            </div>`;
                }).join('')}
        </div>
        </div>`;
            }
        });

        document.getElementById('summary-content').innerHTML = html ||
            '<div style="color:#adb5bd; font-style:italic; text-align:center; padding: 20px;">Chart is healthy. No treatments needed.</div>';
    }

    window.deleteProsthetic = function (id) {
        if (!confirm('Delete this prosthetic?')) return;
        fetch(`/patients/${patientId}/api/prosthetics/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrfToken }
        }).then(() => {
            savedProsthetics = savedProsthetics.filter(p => p.id !== id);
            drawAllProsthetics();
            updateSummary();
        });
    };

    function updateLabel(key, state) {
        const label = document.getElementById(`txtTooth${key}`);
        if (!label) return;
        const map = {
            'decayed': ['D', '#ff4d4d'],
            'filled': ['F', '#4d94ff'],
            'missing': ['M', '#adb5bd'],
            'implant': ['I', '#9c27b0'],
            'crown': ['C', '#ffd700']
        };
        if (map[state]) {
            label.textContent = map[state][0];
            label.style.fill = map[state][1];
        } else {
            label.textContent = '';
        }
    }
    // Event delegation for dynamically created delete buttons
    document.getElementById('summary-content').addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-prosthetic-btn');
        if (btn) {
            const id = parseInt(btn.getAttribute('data-prosthetic-id'));
            window.deleteProsthetic(id);
        }
    });
});
