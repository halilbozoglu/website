/** 
 * Constants & Config 
 */
const GRADE_SCALE = [
    { min: 82, max: 100, coeff: 4.00, letter: 'AA' },
    { min: 74, max: 81, coeff: 3.50, letter: 'BA' },
    { min: 65, max: 73, coeff: 3.00, letter: 'BB' },
    { min: 58, max: 64, coeff: 2.50, letter: 'CB' },
    { min: 50, max: 57, coeff: 2.00, letter: 'CC' },
    { min: 40, max: 49, coeff: 1.50, letter: 'DC' },
    { min: 35, max: 39, coeff: 1.00, letter: 'DD' },
    { min: 25, max: 34, coeff: 0.50, letter: 'FD' },
    { min: 0, max: 24, coeff: 0.00, letter: 'FF' }
];
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
    const rounded = Math.round(score);
    return GRADE_SCALE.find(g => rounded >= g.min && rounded <= g.max) || { coeff: 0.00, letter: 'FF' };
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
            TARGET_LETTERS.forEach(letter => {
                const g = GRADE_SCALE.find(gr => gr.letter === letter);
                if (g) {
                    let req = Math.ceil((g.min - currentPoints) / fRatio);
                    if (req <= 100) targetsHtml += `<div class="target-item"><span class="t-lbl">${letter}</span><span>${req < 0 ? 0 : req}</span></div>`;
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

        if (!isNaN(v) && !isNaN(f)) {
            const mRatio = state.settings.vizeRatio / 100;
            const fRatio = state.settings.finalRatio / 100;
            let avg = parseFloat(((v * mRatio) + (f * fRatio)).toFixed(2));
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
