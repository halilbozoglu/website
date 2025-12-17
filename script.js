/** 
 * Constants & Config 
 */
const GRADE_SCALE = [];
// Generate granular scale based on Konya Technical University / YÖK control points
// Control Points derived from image: 4.00=100, 3.50=81, 3.00=73, 2.50=64, 2.00=57, 1.50=49, 1.00=39, 0.50=34, 0.00=0
const CONTROL_POINTS = [
    { score: 100, coeff: 4.00 },
    { score: 81, coeff: 3.50 },
    { score: 73, coeff: 3.00 },
    { score: 64, coeff: 2.50 },
    { score: 57, coeff: 2.00 },
    { score: 49, coeff: 1.50 },
    { score: 39, coeff: 1.00 },
    { score: 34, coeff: 0.50 },
    { score: 29, coeff: 0.00 } // Extrapolating 0.00 starts below 34, usually roughly here or just 0
];
// Note: detailed table shows 0.50 is 34.00, below that is FF.
// We will generate values for every 0.01 coefficient step between points.

function generateScale() {
    for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
        const high = CONTROL_POINTS[i];
        const low = CONTROL_POINTS[i + 1];

        const scoreRange = high.score - low.score;
        const coeffRange = high.coeff - low.coeff;
        const steps = Math.round(coeffRange * 100); // e.g. 50 steps

        for (let j = 0; j < steps; j++) {
            const coeff = parseFloat((high.coeff - (j * 0.01)).toFixed(2));
            // Linear interpolation for score
            const score = high.score - ((j / steps) * scoreRange);
            GRADE_SCALE.push({
                min: parseFloat((score - (scoreRange / steps) + 0.001).toFixed(2)),
                max: parseFloat(score.toFixed(2)),
                coeff: coeff,
                letter: getLetterForCoeff(coeff)
            });
        }
    }
    // Add FF range
    GRADE_SCALE.push({ min: 0, max: 33.99, coeff: 0.00, letter: 'FF' });
}

function getLetterForCoeff(c) {
    if (c >= 3.50) return 'AA'; // Adjustment: usually 4.0=AA, 3.5=BA. But granular might need generic fallback.
    // Actually, let's keep the standard letters for display purposes based on the coefficient
    if (c >= 4.00) return 'AA';
    if (c >= 3.50) return 'BA';
    if (c >= 3.00) return 'BB';
    if (c >= 2.50) return 'CB';
    if (c >= 2.00) return 'CC';
    if (c >= 1.50) return 'DC';
    if (c >= 1.00) return 'DD';
    if (c >= 0.50) return 'FD';
    return 'FF';
}
generateScale();
const TARGET_LETTERS = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC'];

// Default State
let state = {
    settings: {
        vizeRatio: 40,
        finalRatio: 60,
        passGrade: 50,
        condGrade: 40
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

    // Fill Settings Inputs
    document.getElementById('vizeRatio').value = state.settings.vizeRatio;
    document.getElementById('finalRatio').value = state.settings.finalRatio;
    document.getElementById('passGrade').value = state.settings.passGrade;
    document.getElementById('condGrade').value = state.settings.condGrade;

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
 * Calculation Logic
 */
function getCoefficient(score) {
    // Round score to 2 decimal places before calculation to match typical inputs
    // But formulas are continuous, so exact value is better.
    // Let's use the exact value or fixed to 2 decimals if that's standard.
    // The user formulas are linear, so directly applying them is best.
    const coeff = calculateCoefficient(score);
    const letter = getLetterForCoeff(coeff);
    return { coeff: coeff, letter: letter };
}

function formatNeeded(s) { return s <= 0 ? "OK" : (s > 100 ? ">100" : Math.ceil(s)); }

function calculateStatus(vize, final, credit, settings) {
    const mRatio = settings.vizeRatio / 100;
    const fRatio = settings.finalRatio / 100;
    const pLimit = settings.passGrade;
    const cLimit = settings.condGrade;

    let rowHtml = "";

    const v = vize === "" ? NaN : parseFloat(vize);
    const f = final === "" ? NaN : parseFloat(final);

    if (!isNaN(v)) {
        if (isNaN(f)) {
            const currentPoints = v * mRatio;
            const neededForPass = (pLimit - currentPoints) / fRatio;
            const neededForCond = (cLimit - currentPoints) / fRatio;

            rowHtml += `<div>Normal: <span class="${neededForPass > 100 ? 'status-fail' : 'status-pass'}">${formatNeeded(neededForPass)}</span> | Şartlı: <span class="${neededForCond > 100 ? 'status-fail' : 'status-cond'}">${formatNeeded(neededForCond)}</span></div>`;

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
            const TARGETS = [
                { l: 'AA', min: 81 },
                { l: 'BA', min: 73 },
                { l: 'BB', min: 64 },
                { l: 'CB', min: 57 },
                { l: 'CC', min: 49 },
                { l: 'DC', min: 39 }
            ];

            TARGETS.forEach(t => {
                const g = t;
                if (g) {
                    let req = Math.ceil((g.min - currentPoints) / fRatio);
                    if (req <= 100) targetsHtml += `<div class="target-item"><span class="t-lbl">${t.l}</span><span>${req < 0 ? 0 : req}</span></div>`;
                }
            });
            if (targetsHtml) rowHtml += `<div class="target-container"><div class="target-grid">${targetsHtml}</div></div>`;
        } else {
            let avg = parseFloat(((v * mRatio) + (f * fRatio)).toFixed(2));
            let status = avg >= pLimit ? ["GEÇTİ", "status-pass"] : (avg >= cLimit ? ["ŞARTLI", "status-cond"] : ["KALDI", "status-fail"]);
            const gInfo = getCoefficient(avg);

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
            let avg = parseFloat(((v * mRatio) + (effectiveFinal * fRatio)).toFixed(2));
            const gInfo = getCoefficient(avg);

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
            <td><input type="number" value="${course.vize}" placeholder="Vize" oninput="updateCourseData(${course.id}, 'vize', this.value)"></td>
            <td><input type="number" value="${course.final}" placeholder="Final" oninput="updateCourseData(${course.id}, 'final', this.value)"></td>
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
['vizeRatio', 'finalRatio', 'passGrade', 'condGrade'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSettings);
});

document.getElementById('addCourseBtn').addEventListener('click', () => addCourse());
document.getElementById('resetBtn').addEventListener('click', clearAll);

// Init
init();
