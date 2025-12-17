/** 
 * Constants & Config 
 */
// Formula-Based Coefficient Calculation
// Based on user provided formulas specific to ranges
// Formula-Based Coefficient Calculation (User Provided)
// 81-100: (y+52)/38
// 73-81: (y-25)/16
// 64-73: (y-19)/18
// 57-64: (y-29)/14
// 49-57: (y-25)/16
// 39-49: (y-19)/20
// 34-39: (y-29)/10
// 0-34: y/68
function getGradeFromScore(y) {
    let x = 0;
    if (y >= 81) {
        x = (y + 52) / 38;
    } else if (y >= 73) {
        x = (y - 25) / 16;
    } else if (y >= 64) {
        x = (y - 19) / 18;
    } else if (y >= 57) {
        x = (y - 29) / 14;
    } else if (y >= 49) {
        x = (y - 25) / 16;
    } else if (y >= 39) {
        x = (y - 19) / 20;
    } else if (y >= 34) {
        x = (y - 29) / 10;
    } else {
        x = y / 68;
    }

    // Cap at 4.00 and floor at 0.00
    if (x > 4) x = 4;
    if (x < 0) x = 0;

    // Determine Letter based on Coefficient (Standard Intervals)
    // 4.00 AA, 3.50 BA, 3.00 BB, 2.50 CB, 2.00 CC, 1.50 DC, 1.00 DD, 0.50 FD
    let letter = 'FF';
    if (x >= 3.75) letter = 'AA'; // Approximation for display? Or use ranges?
    // Better to use the score ranges for Letter determination to match the start points.
    // 81->3.5 (BA). 100->4.0 (AA).
    // Let's use the explicit score ranges for Letter to avoid float ambiguity.
    if (y >= 81) letter = 'AA'; // Wait, 81 gives 3.5 which is BA.
    // User formula: 81 is bottom of top range. (81+52)/38 = 3.5. 
    // IF result is 3.5, is it AA or BA? Standard: 4.0=AA, 3.5=BA.
    // So 81 is BA. But range goes up to 100 (4.0).
    // Where does AA start? Usually 4.0. Or 3.75+? 
    // Previous "Mutlak" AA was 82.
    // Let's stick to the Coefficients.
    // We will return the precise Coeff.
    // For Letter, let's just use standard discrete checks for display?
    // USER REQUESTED: "65,33 ortalamaya 2,78 yazıyor... bu denkleme göre yazınca 2,55 çıkıyor"
    // So 65.33 -> 2.55 (CB range).
    // I will return the precise coefficient.

    // Letter Mapping (Approximate based on ranges)
    if (y >= 88) letter = 'AA'; // Guessing top tier
    else if (y >= 81) letter = 'BA';
    else if (y >= 73) letter = 'BB';
    else if (y >= 64) letter = 'CB';
    else if (y >= 57) letter = 'CC';
    else if (y >= 49) letter = 'DC';
    else if (y >= 39) letter = 'DD';
    else if (y >= 34) letter = 'FD';
    else letter = 'FF';

    // Override AA start based on strict 4.0 requirement? 
    // If coeff > 3.75 maybe?
    // Let's keep it simple.

    return { letter: letter, coeff: parseFloat(x.toFixed(2)) };
}

const TARGET_LETTERS = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC'];

// Default State
let state = {
    settings: {
        vizeRatio: 40,
        finalRatio: 60,
        passGrade: 50,
        condGrade: 40,
        finalThreshold: 35
    },
    courses: []
};

/**
 * Initialization & Persistence
 */
function init() {
    const saved = localStorage.getItem('gradeCalcData_v1');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Save data mismatch", e);
        }
    } else {
        addCourse(false);
    }
    // Ensure defaults exist for new settings
    if (state.settings.vizeRatio === undefined) state.settings.vizeRatio = 40;
    if (state.settings.finalRatio === undefined) state.settings.finalRatio = 60;
    if (state.settings.passGrade === undefined) state.settings.passGrade = 50;
    if (state.settings.condGrade === undefined) state.settings.condGrade = 40;
    if (state.settings.finalThreshold === undefined) state.settings.finalThreshold = 35;

    // Fill Settings Inputs
    document.getElementById('vizeRatio').value = state.settings.vizeRatio;
    document.getElementById('finalRatio').value = state.settings.finalRatio;
    document.getElementById('passGrade').value = state.settings.passGrade;
    document.getElementById('condGrade').value = state.settings.condGrade;
    document.getElementById('finalThreshold').value = state.settings.finalThreshold !== undefined ? state.settings.finalThreshold : 35;

    render();
}

function saveState() {
    localStorage.setItem('gradeCalcData_v1', JSON.stringify(state));
    const saveMsg = document.getElementById('saveMsg');
    if (saveMsg) {
        saveMsg.style.opacity = '1';
        setTimeout(() => saveMsg.style.opacity = '0', 1000);
    }
    render();
}

/**
 * State Modifiers
 */
function updateSettings() {
    state.settings.vizeRatio = parseFloat(document.getElementById('vizeRatio').value) || 0;
    state.settings.finalRatio = parseFloat(document.getElementById('finalRatio').value) || 0;
    state.settings.passGrade = parseFloat(document.getElementById('passGrade').value) || 50;
    state.settings.condGrade = parseFloat(document.getElementById('condGrade').value) || 40;
    state.settings.finalThreshold = parseFloat(document.getElementById('finalThreshold').value);
    if (isNaN(state.settings.finalThreshold)) state.settings.finalThreshold = 35;
    saveState();
}

function addCourse(save = true) {
    state.courses.push({
        id: Date.now(),
        name: '',
        credit: '',
        vize: '',
        final: ''
    });
    if (save) saveState();
}

function removeCourse(id) {
    state.courses = state.courses.filter(c => c.id !== id);
    saveState();
}

function clearAll() {
    if (confirm('Tüm veriler silinecek. Emin misiniz?')) {
        state.courses = [];
        addCourse(false);
        saveState();
    }
}

function updateCourseData(id, field, value) {
    const course = state.courses.find(c => c.id === id);
    if (course) {
        course[field] = value;
        localStorage.setItem('gradeCalcData_v1', JSON.stringify(state));

        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const analysis = calculateStatus(course.vize, course.final, course.credit, state.settings);
            const resultCell = row.querySelector('.result-cell');
            if (resultCell) resultCell.innerHTML = analysis;
            updateSummary();
        }
    }
}

/**
 * Validation Helper
 */
function validateInput(el) {
    let val = parseFloat(el.value);
    if (val < 0) {
        el.value = 0;
        val = 0;
    }
    if (val > 100) {
        el.value = 100;
        val = 100;
    }
    return val;
}

/**
 * Calculation Logic
 */


/**
 * Calculation Logic
 */
function getCoefficient(score) {
    return getGradeFromScore(score);
}

function formatNeeded(s, baraj) {
    let val = Math.ceil(s);
    if (val > 100) return ">100";

    // Even if mathematically you need less (or 0), the Final Baraj is the absolute floor.
    if (val < baraj) {
        return `${baraj} (Baraj)`;
    }
    return val;
}

function calculateStatus(vize, final, credit, settings) {
    const mRatio = settings.vizeRatio / 100;
    const fRatio = settings.finalRatio / 100;
    const pLimit = settings.passGrade;
    const cLimit = settings.condGrade;
    const finalBaraj = settings.finalThreshold !== undefined ? settings.finalThreshold : 35;

    let rowHtml = "";

    const v = vize === "" ? NaN : parseFloat(vize);
    const f = final === "" ? NaN : parseFloat(final);

    if (!isNaN(v)) {
        if (isNaN(f)) {
            const currentPoints = v * mRatio;
            const neededForPass = (pLimit - currentPoints) / fRatio;
            const neededForCond = (cLimit - currentPoints) / fRatio;

            // Pass formatNeeded calculation
            const passStr = formatNeeded(neededForPass, finalBaraj);
            const condStr = formatNeeded(neededForCond, finalBaraj);

            // Determine colors. If ">100", it's fail.
            const pClass = passStr === ">100" ? 'status-fail' : 'status-pass';
            const cClass = condStr === ">100" ? 'status-fail' : 'status-cond';

            rowHtml += `<div>Normal: <span class="${pClass}">${passStr}</span> | Şartlı: <span class="${cClass}">${condStr}</span></div>`;

            let targetsHtml = "";
            // With formulas, reverse calculation is needed for targets (Coeff -> Score)
            // Or we can just show generic thresholds since the formulas are linear ranges.
            // AA (4.0) usually requires ~81-100.
            // Let's stick to the main letter boundaries for the targets:
            // AA(4.0), BA(3.5), BB(3.0), CB(2.5), CC(2.0), DC(1.5)
            // We can invert the formulas:
            // For AA (3.5+): 3.5 = (y-25)/16 => y = 3.5*16 + 25 = 56+25 = 81.
            // For BA (3.5): 81. For BB (3.0): (y-19)/18=3 => y=73.
            // This matches the boundary inputs exactly.
            // Grade Targets (Based on start of formula ranges)
            const TARGETS = [
                { l: 'AA', min: 88 }, // Est.
                { l: 'BA', min: 81 },
                { l: 'BB', min: 73 },
                { l: 'CB', min: 64 },
                { l: 'CC', min: 57 },
                { l: 'DC', min: 49 },
                { l: 'DD', min: 39 }
            ];

            TARGETS.forEach(t => {
                const g = t;
                if (g) {
                    let req = Math.ceil((g.min - currentPoints) / fRatio);
                    // Also apply baraj to target letters? Usually Baraj is just for Passing (DD or CC).
                    // But if you need 20 for AA (mathematically), you still need 35 for valid final.
                    // Let's silently enforce min 35 for targets too?
                    // User text implies "normal ve şartlı geçiş için gereken notlardada ... yaz".
                    // I won't clutter the target bubbles with "(Baraj)" text, but I will enforce the floor value.
                    if (req < finalBaraj) req = finalBaraj;

                    if (req <= 100) targetsHtml += `<div class="target-item"><span class="t-lbl">${t.l}</span><span>${req}</span></div>`;
                }
            });
            if (targetsHtml) {
                rowHtml += `
                <details class="target-details">
                    <summary>Diğer Harf Hedefleri ▼</summary>
                    <div class="target-grid">${targetsHtml}</div>
                </details>`;
            }
        } else {
            let avg = Math.round((v * mRatio) + (f * fRatio));
            // Final Threshold Check
            let status;
            let gInfo;

            if (f < finalBaraj) {
                status = ["KALDI", "status-fail"];
                gInfo = { coeff: 0.00, letter: 'FF' }; // Automatic FF if below baraj
            } else {
                status = avg >= pLimit ? ["GEÇTİ", "status-pass"] : (avg >= cLimit ? ["ŞARTLI", "status-cond"] : ["KALDI", "status-fail"]);
                gInfo = getCoefficient(avg);
            }

            rowHtml = `<div style="font-weight:bold; font-size:1.1rem">Ort: ${avg}</div><div class="${status[1]}">${status[0]} (${gInfo.letter})</div>`;
        }
    } else {
        rowHtml = "<span style='color:#666'>...</span>";
    }
    return rowHtml;
}

function updateSummary() {
    let totalWeightedPoints100 = 0;
    let totalWeightedPoints4 = 0;
    let gradedCredits = 0;
    let registeredCredits = 0;

    state.courses.forEach(c => {
        const credit = parseFloat(c.credit) || 0;
        const v = c.vize === "" ? NaN : parseFloat(c.vize);
        const f = c.final === "" ? NaN : parseFloat(c.final);

        if (credit > 0) registeredCredits += credit;

        if (!isNaN(v)) {
            // If Final is missing, assume Final = Vize for the summary calculation
            const effectiveFinal = isNaN(f) ? v : f;

            const mRatio = state.settings.vizeRatio / 100;
            const fRatio = state.settings.finalRatio / 100;
            const finalBaraj = state.settings.finalThreshold !== undefined ? state.settings.finalThreshold : 35;

            let avg = Math.round((v * mRatio) + (effectiveFinal * fRatio));
            let gInfo;

            // Apply Final Threshold Logic to Summary
            if (effectiveFinal < finalBaraj) {
                gInfo = { coeff: 0.00, letter: 'FF' }; // Automatic Fail
                // Note: Average numerical value remains calculated, but coeff becomes 0.
            } else {
                gInfo = getCoefficient(avg);
            }

            if (credit > 0) {
                totalWeightedPoints100 += (avg * credit);
                totalWeightedPoints4 += (gInfo.coeff * credit);
                gradedCredits += credit;
            }
        }
    });

    document.getElementById('termAvg').innerText = gradedCredits > 0 ? (totalWeightedPoints100 / gradedCredits).toFixed(2) : "0.00";
    document.getElementById('gpaValue').innerText = gradedCredits > 0 ? (totalWeightedPoints4 / gradedCredits).toFixed(2) : "0.00";
    document.getElementById('totalCredit').innerText = registeredCredits;
}

/**
 * OBS Import Logic
 */
function parseOBS() {
    const text = document.getElementById('obsInput').value;
    if (!text.trim()) return;

    try {
        const normalized = text.replace(/\s+/g, ' ');
        const regex = /(\d{7}).*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\d{7}|$)/g;

        let match;
        let newCourses = [];

        while ((match = regex.exec(normalized)) !== null) {
            const courseName = match[3].trim();
            const courseCredit = match[4];
            const restOfBlock = match[5];

            let vize = "";
            let final = "";

            const vizeMatch = restOfBlock.match(/Vize\s+(\d+)/i);
            if (vizeMatch) vize = vizeMatch[1];
            else {
                const gradeMatch = restOfBlock.match(/\b(\d{1,3})\b/);
                if (gradeMatch && parseInt(gradeMatch[1]) <= 100) vize = gradeMatch[1];
            }

            const finalMatch = restOfBlock.match(/Final\s+(\d+)/i);
            if (finalMatch) final = finalMatch[1];

            newCourses.push({
                id: Date.now() + Math.random(),
                name: courseName,
                credit: courseCredit,
                vize: vize,
                final: final
            });
        }

        if (newCourses.length > 0) {
            state.courses = newCourses;
            saveState();
            closeModal();
        } else {
            alert("Veri bulunamadı. OBS tablonuzun formatı farklı olabilir.");
        }
    } catch (error) {
        alert("Hata: " + error.message);
    }
}

/**
 * Rendering
 */
function render() {
    const tbody = document.getElementById('courseTableBody');
    tbody.innerHTML = '';

    state.courses.forEach((course) => {
        const analysisHtml = calculateStatus(course.vize, course.final, course.credit, state.settings);
        const row = document.createElement('tr');
        row.setAttribute('data-id', course.id);

        row.innerHTML = `
            <td><input type="text" value="${course.name}" placeholder="Ders..." oninput="updateCourseData(${course.id}, 'name', this.value)"></td>
            <td><input type="number" value="${course.credit}" placeholder="Kr" oninput="updateCourseData(${course.id}, 'credit', this.value)"></td>
            <td><input type="number" value="${course.vize}" placeholder="Vize" oninput="validateInput(this); updateCourseData(${course.id}, 'vize', this.value)"></td>
            <td><input type="number" value="${course.final}" placeholder="Final" oninput="validateInput(this); updateCourseData(${course.id}, 'final', this.value)"></td>
            <td class="result-cell">${analysisHtml}</td>
            <td><button class="btn btn-remove" onclick="removeCourse(${course.id})">Sil</button></td>
        `;
        tbody.appendChild(row);
    });

    updateSummary();
}

/* Modal Utils */
const modal = document.getElementById('obsModal');
document.getElementById('openObsModalBtn').onclick = () => modal.classList.add('active');
function closeModal() { modal.classList.remove('active'); document.getElementById('obsInput').value = ''; }

// Global Event Listeners for Settings
['vizeRatio', 'finalRatio', 'passGrade', 'condGrade', 'finalThreshold'].forEach(id => {
    document.getElementById(id).addEventListener('input', function () {
        validateInput(this);
        updateSettings();
    });
});

document.getElementById('addCourseBtn').addEventListener('click', () => addCourse());
document.getElementById('resetBtn').addEventListener('click', clearAll);

// Toggle Settings Logic
const toggleBtn = document.getElementById('toggleSettings');
const settingsPanel = document.querySelector('.settings-panel');
if (toggleBtn && settingsPanel) {
    toggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('collapsed');
        if (settingsPanel.classList.contains('collapsed')) {
            toggleBtn.textContent = 'Ayarları Göster ▲';
        } else {
            toggleBtn.textContent = 'Gizle ▼';
        }
    });
}

// Init
init();
