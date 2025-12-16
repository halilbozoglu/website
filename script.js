/** 
 * Constants & Config 
 */
const LETTER_GRADES = [
    { min: 82, label: 'AA', coeff: 4.00 },
    { min: 74, label: 'BA', coeff: 3.50 },
    { min: 65, label: 'BB', coeff: 3.00 },
    { min: 58, label: 'CB', coeff: 2.50 },
    { min: 50, label: 'CC', coeff: 2.00 },
    { min: 40, label: 'DC', coeff: 1.50 },
    { min: 35, label: 'DD', coeff: 1.00 },
    { min: 25, label: 'FD', coeff: 0.50 },
    { min: 0, label: 'FF', coeff: 0.00 }
];

const FINAL_THRESHOLD = 35; // Sabit Final Barajı

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
            const parsed = JSON.parse(saved);
            state = parsed;
        } catch (e) {
            console.error("Save data mismatch", e);
        }
    } else {
        // Add one default empty row if fresh start
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
    render(); // Re-render for updates
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
        credit: 3,
        vize: '',
        final: ''
    });
    if (save) saveState();
}

function removeCourse(id) {
    if (confirm('Bu dersi silmek istediğinize emin misiniz?')) {
        state.courses = state.courses.filter(c => c.id !== id);
        saveState();
    }
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
        saveState();
    }
}

/**
 * Calculation Logic
 */
function getLetterGrade(score) {
    const rounded = Math.round(score);
    for (let g of LETTER_GRADES) {
        if (rounded >= g.min) return g;
    }
    return LETTER_GRADES[LETTER_GRADES.length - 1]; // FF
}

function calculateStatus(vize, final, credit, settings) {
    const vRatio = settings.vizeRatio / 100;
    const fRatio = settings.finalRatio / 100;

    let result = {
        avg: null,
        letter: '?',
        coeff: 0.00,
        statusColor: 'status-neutral',
        statusText: '-',
        analysisHtml: ''
    };

    const hasVize = vize !== '' && vize !== null;
    const hasFinal = final !== '' && final !== null;

    const v = parseFloat(vize) || 0;
    const f = parseFloat(final) || 0;

    // SCENARIO 1: Only Vize (Analysis Mode)
    if (hasVize && !hasFinal) {
        result.statusText = 'Final Bekleniyor';

        // Calculate Needed Finals
        const neededForPass = (settings.passGrade - (v * vRatio)) / fRatio;
        const neededForCond = (settings.condGrade - (v * vRatio)) / fRatio;

        // Apply Threshold Rule
        const targetPass = Math.max(Math.ceil(neededForPass), FINAL_THRESHOLD);
        const targetCond = Math.max(Math.ceil(neededForCond), FINAL_THRESHOLD);

        let html = `<div style="font-size:11px; line-height:1.4;">`;

        // Can pass?
        if (targetPass > 100) {
            html += `<span style="color:var(--error)">Normal Geçiş İmkansız</span>`;
        } else {
            html += `<span style="color:var(--success)">${targetPass}</span> (Geçme)<br>`;
        }

        // Can cond?
        if (targetCond <= 100 && targetCond < targetPass) {
            html += `<span style="color:var(--warning)">${targetCond}</span> (Şartlı)`;
        }

        html += `</div>`;
        result.analysisHtml = html;
        return result;
    }

    // SCENARIO 2: Vize + Final (Result Mode)
    if (hasVize && hasFinal) {
        const average = (v * vRatio) + (f * fRatio);
        result.avg = average.toFixed(2); // Keep precision for now

        // 1. Check Final Threshold
        if (f < FINAL_THRESHOLD) {
            result.letter = 'FF';
            result.coeff = 0.00;
            result.statusText = 'KALDI (Baraj)';
            result.statusColor = 'status-fail';
            result.analysisHtml = `<span style="color:var(--error)">Final ${FINAL_THRESHOLD}'in altında</span>`;
            return result;
        }

        // 2. Normal Scale
        const gradeInfo = getLetterGrade(average);
        result.letter = gradeInfo.label;
        result.coeff = gradeInfo.coeff;

        // 3. Status Check based on Average vs Goals
        if (Math.round(average) >= settings.passGrade) { // CC and up usually
            result.statusText = 'GEÇTİ';
            result.statusColor = 'status-pass';
        } else if (Math.round(average) >= settings.condGrade) {
            result.statusText = 'ŞARTLI';
            result.statusColor = 'status-cond';
        } else {
            result.statusText = 'KALDI';
            result.statusColor = 'status-fail';
        }

        result.analysisHtml = `Ort: <b>${result.avg}</b> <span class="status-badge ${result.statusColor}">${result.letter}</span>`;
        return result;
    }

    return result;
}

/**
 * OBS Import Logic
 */
function parseOBS() {
    const text = document.getElementById('obsInput').value;
    if (!text.trim()) return;

    // 1. Normalize spaces
    const normalized = text.replace(/\t/g, ' ').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ');

    // 2. Regex
    // Pattern: Code(7digit) ... Year(20xx) ... Name ... Credit ... Rest
    const regex = /(\d{7}).*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\d{7}|$)/g;

    let match;
    let count = 0;
    let newCourses = [];

    while ((match = regex.exec(normalized)) !== null) {
        const courseName = match[3].trim(); // Name
        const credit = parseInt(match[4]); // Credit
        const rest = match[5].trim(); // The part after credit

        // Try to find grades in the 'rest' string
        // Looking for identifying numbers. Assuming first number 0-100 is Vize.
        // OBS formats vary, but often it's "Code Year Name Credit Grade"
        // We use a simple regex to find the first independent number
        let vizeVal = '';

        // Matches a number that is not part of a larger word
        // We ignore things that look like dates or IDs if possible, but simplest is 
        // just finding the first 1-3 digit number.
        const gradeMatch = rest.match(/\b(\d{1,3})\b/);
        if (gradeMatch) {
            const val = parseInt(gradeMatch[1]);
            if (val >= 0 && val <= 100) {
                vizeVal = val;
            }
        }

        newCourses.push({
            id: Date.now() + count,
            name: courseName,
            credit: isNaN(credit) ? 3 : credit,
            vize: vizeVal,
            final: ''
        });
        count++;
    }

    if (count > 0) {
        // Keep existing or replace? Usually append is safer or clear empty.
        // Let's remove the default empty row if it exists and is pristine
        if (state.courses.length === 1 && state.courses[0].name === '') {
            state.courses = [];
        }
        state.courses = [...state.courses, ...newCourses];
        saveState();
        closeModal();
        alert(`${count} ders başarıyla eklendi!`);
    } else {
        alert('Uygun formatta veri bulunamadı. Lütfen OBS tablosunu doğru kopyaladığınızdan emin olun.');
    }
    document.getElementById('obsInput').value = '';
}

/**
 * Rendering
 */
function render() {
    const tbody = document.getElementById('courseTableBody');
    tbody.innerHTML = '';

    let totalCredit = 0;
    let weightedScoreSum = 0;
    let weightedGPASum = 0;
    let enteredCreditSum = 0; // Credits of courses with grades
    let enteredCreditSumForGPA = 0; // Credits of courses with full grades

    if (state.courses.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
    } else {
        document.getElementById('emptyState').style.display = 'none';
    }

    state.courses.forEach((course, index) => {
        const analysis = calculateStatus(course.vize, course.final, course.credit, state.settings);
        const cr = parseFloat(course.credit) || 0;
        totalCredit += cr;

        if (analysis.avg !== null) {
            // Course is fully entered
            const avgVal = parseFloat(analysis.avg);
            weightedScoreSum += avgVal * cr;
            weightedGPASum += analysis.coeff * cr;
            enteredCreditSum += cr;
            enteredCreditSumForGPA += cr;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
        <td>${index + 1}</td>
        <td>
            <input type="text" class="course-name-input" value="${course.name}" 
                   placeholder="Ders Adı" 
                   onchange="updateCourseData(${course.id}, 'name', this.value)">
        </td>
        <td>
            <input type="number" class="credit-input" value="${course.credit}" min="0"
                   onchange="updateCourseData(${course.id}, 'credit', this.value)">
        </td>
        <td>
            <input type="number" class="grade-input" value="${course.vize}" placeholder="-" min="0" max="100"
                   oninput="updateCourseData(${course.id}, 'vize', this.value)">
        </td>
        <td>
            <input type="number" class="grade-input" value="${course.final}" placeholder="-" min="0" max="100"
                   oninput="updateCourseData(${course.id}, 'final', this.value)">
        </td>
        <td>
            <span style="font-size:13px;">${analysis.statusText}</span>
            <div class="analysis-text">${analysis.analysisHtml}</div>
        </td>
        <td>
            <button class="danger-btn" onclick="removeCourse(${course.id})" style="padding: 4px 8px; font-size:12px;">Sil</button>
        </td>
    `;
        tbody.appendChild(row);
    });

    // Update Footer Summary
    document.getElementById('totalCredit').textContent = totalCredit;

    const termAvg = enteredCreditSum > 0 ? (weightedScoreSum / enteredCreditSum).toFixed(2) : '0.00';
    document.getElementById('termAvg').textContent = termAvg;

    const gpa = enteredCreditSumForGPA > 0 ? (weightedGPASum / enteredCreditSumForGPA).toFixed(2) : '0.00';
    document.getElementById('gpaValue').textContent = gpa;
}

/* Modal Utils */
const modal = document.getElementById('obsModal');
document.getElementById('openObsModalBtn').onclick = () => modal.classList.add('active');
function closeModal() { modal.classList.remove('active'); }

// Global Event Listeners for Settings
['vizeRatio', 'finalRatio', 'passGrade', 'condGrade'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSettings);
});

document.getElementById('addCourseBtn').addEventListener('click', () => addCourse());
document.getElementById('resetBtn').addEventListener('click', clearAll);

// Initial Start
init();
