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
    let letter = 'FF';
    let x = 0.00;

    // User Provided Discrete Ranges & Coefficients:
    // 82-100 = AA = 4,00
    // 74-81  = BA = 3,50
    // 65-73  = BB = 3,00
    // 58-64  = BC = 2,50
    // 50-57  = CC = 2,00
    // 40-49  = DC = 1,50
    // 35-39  = DD = 1,00
    // 25-34  = FD = 0,50
    // 0-24   = FF = 0,00

    if (y >= 82) {
        letter = 'AA';
        x = 4.00;
    } else if (y >= 74) {
        letter = 'BA';
        x = 3.50;
    } else if (y >= 65) {
        letter = 'BB';
        x = 3.00;
    } else if (y >= 58) {
        letter = 'CB';
        x = 2.50;
    } else if (y >= 50) {
        letter = 'CC';
        x = 2.00;
    } else if (y >= 40) {
        letter = 'DC';
        x = 1.50;
    } else if (y >= 35) {
        letter = 'DD';
        x = 1.00;
    } else if (y >= 25) {
        letter = 'FD';
        x = 0.50;
    } else {
        letter = 'FF';
        x = 0.00;
    }

    return { letter: letter, coeff: x };
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
    courses: [],
    currentSemester: 'Genel', // Default tab
    semesters: ['Genel']
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
        final: '',
        semester: state.currentSemester // Assign current tab as semester
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
        // Reset semesters to default so sidebar hides
        state.semesters = ['Genel'];
        state.currentSemester = 'Genel';

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
            if (resultCell) {
                // Preserve details panel state
                const details = resultCell.querySelector('details');
                const wasOpen = details && details.hasAttribute('open');

                resultCell.innerHTML = analysis;

                if (wasOpen) {
                    const newDetails = resultCell.querySelector('details');
                    if (newDetails) newDetails.setAttribute('open', '');
                }
            }
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

    const v = vize === "" ? NaN : parseInputFloat(vize);
    const f = final === "" ? NaN : parseInputFloat(final);

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
                { l: 'AA', min: 82 },
                { l: 'BA', min: 74 },
                { l: 'BB', min: 65 },
                { l: 'CB', min: 58 },
                { l: 'CC', min: 50 },
                { l: 'DC', min: 40 },
                { l: 'DD', min: 35 }
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
            let avg = (v * mRatio) + (f * fRatio);
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

            // Display: Round average for UI display? User said "Sonucu virgülden sonra 2 basamak".
            // That applies to Coeff "x". But showing Average with 2 decimals is also good practice.
            rowHtml = `<div style="font-weight:bold; font-size:1.1rem">Ort: ${avg.toFixed(2)}</div><div class="${status[1]}">${status[0]} (${gInfo.letter})</div>`;
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

    // Filter for Term Average: Only visible semester
    // Filter for Term Average: Only visible semester
    const visibleCourses = state.currentSemester === 'Genel'
        ? state.courses
        : state.courses.filter(c => c.semester === state.currentSemester);

    visibleCourses.forEach(c => {
        const credit = parseFloat(c.credit) || 0;
        // Handle comma inputs for Turkish users
        let vVal = c.vize.toString().replace(',', '.');
        let fVal = c.final.toString().replace(',', '.');
        let v = vVal === "" ? NaN : parseFloat(vVal);
        let f = fVal === "" ? NaN : parseFloat(fVal);

        if (credit > 0) registeredCredits += credit;

        if (!isNaN(v)) {
            // If Final is missing, assume Final = Vize for the summary calculation
            const effectiveFinal = isNaN(f) ? v : f;

            const mRatio = state.settings.vizeRatio / 100;
            const fRatio = state.settings.finalRatio / 100;
            const finalBaraj = state.settings.finalThreshold !== undefined ? state.settings.finalThreshold : 35;

            let avg = (v * mRatio) + (effectiveFinal * fRatio);

            // For GANO, we now calculate Weighted Average Score first (User Request Consistency)
            // But we must respect Final Baraj for "Passing" logic if we want consistency?
            // Actually, if a course fails Baraj, its score contributes to average (e.g. 50), 
            // but normally its GANO coeff is 0.
            // If we switch to "Avg Score -> Coeff", then a Baraj-Fail (50) contributes 50 to the pool.
            // The final "Avg Score" (e.g. 68) is then mapped to 2.72.
            // This HIDES the fact that one course failed with 0.0 coeff.
            // User complained "Avg 68 -> 2.54". (The 2.54 reflects the fail).
            // User said "düzelt", suggesting they want 2.72 (Avg based).
            // I will implement "Avg Score Based GANO" as requested.

            if (credit > 0) {
                totalWeightedPoints100 += (avg * credit);
                gradedCredits += credit;
            }
        }
    });

    let termAvgScore = gradedCredits > 0 ? (totalWeightedPoints100 / gradedCredits) : 0;

    // Calculate GPA based on the Term Average Score (User Preferred Method)
    let termGpaInfo = getCoefficient(termAvgScore);

    document.getElementById('termAvg').innerText = termAvgScore.toFixed(2);

    // GANO (Cumulative) - Always calculate for ALL courses with credits
    let totalWeightedGpaPoints = 0;
    let totalCreditsAll = 0;
    state.courses.forEach(c => {
        const cr = parseFloat(c.credit) || 0;
        if (cr > 0) {
            let vVal = c.vize.toString().replace(',', '.');
            let fVal = c.final.toString().replace(',', '.');
            let v = vVal === "" ? NaN : parseFloat(vVal);
            let f = fVal === "" ? NaN : parseFloat(fVal);

            if (!isNaN(v)) {
                const effectiveFinal = isNaN(f) ? v : f;
                const mRatio = state.settings.vizeRatio / 100;
                const fRatio = state.settings.finalRatio / 100;
                const finalBaraj = state.settings.finalThreshold !== undefined ? state.settings.finalThreshold : 35;

                let avg = (v * mRatio) + (effectiveFinal * fRatio);

                // Get 4.0 coefficient for this specific course
                let courseCoeffInfo = getCoefficient(avg);
                let courseCoeff = courseCoeffInfo.coeff;

                // Enforce Final Baraj for GANO calculation
                // If final is below baraj, the course fails (FF = 0.00), regardless of average
                if (effectiveFinal < finalBaraj) {
                    courseCoeff = 0.00;
                }

                totalWeightedGpaPoints += (courseCoeff * cr);
                totalCreditsAll += cr;
            }
        }
    });

    let gpaValue = totalCreditsAll > 0 ? (totalWeightedGpaPoints / totalCreditsAll) : 0;

    document.getElementById('gpaValue').innerText = gpaValue.toFixed(2);

    // Display Total Credits (Context Aware? Or Total?)
    // Let's show currently visible credits for 'Total Credit' context
    document.getElementById('totalCredit').innerText = registeredCredits;
}

/**
 * Sidebar Logic
 */
function renderSidebar() {
    // Correctly reference the sidebar container for visibility toggle
    const sidebarContainer = document.getElementById('semesterSidebar');
    const listContainer = document.getElementById('semesterList');

    if (!sidebarContainer || !listContainer) return;

    // Ensure semesters list is up to date based on courses
    const usedSemesters = new Set(state.courses.map(c => c.semester).filter(s => s));
    usedSemesters.add('Genel');

    // Re-sync state.semesters with used ones + keep existing order if possible
    let newSemesters = [...state.semesters];
    usedSemesters.forEach(s => {
        if (!newSemesters.includes(s)) newSemesters.push(s);
    });
    // Filter out semesters that no longer exist (except Genel)
    // Actually, if a user deleted all courses in a semester, should the tab disappear? Not necessarily.
    // Keeping existing behavior: accumulating.

    state.semesters = newSemesters;

    // VISIBILITY CHECK: Hide if only 'Genel' exists
    const isDefaultOnly = state.semesters.length === 1 && state.semesters[0] === 'Genel';

    if (isDefaultOnly) {
        sidebarContainer.style.display = 'none';
        // Expand content? CSS Flex should handle it if sidebar is display:none
    } else {
        sidebarContainer.style.display = 'block';
    }

    listContainer.innerHTML = '';

    state.semesters.forEach(sem => {
        const btn = document.createElement('button');
        btn.className = `sidebar-item ${state.currentSemester === sem ? 'active' : ''}`;
        btn.innerText = sem;
        btn.onclick = () => {
            state.currentSemester = sem;
            saveState();
            render(); // Re-render table and sidebar
        };
        listContainer.appendChild(btn);
    });
}

function addNewSemester() {
    const name = prompt("Dönem Adı (Örn: 2025-2026 Yaz):");
    if (name && !state.semesters.includes(name)) {
        state.semesters.push(name);
        state.currentSemester = name;
        saveState();
        render();
    }
}

// Helper for comma in live update
function parseInputFloat(val) {
    if (!val) return NaN;
    return parseFloat(val.toString().replace(',', '.'));
}

/**
 * OBS Import Logic
 */
function parseOBS() {
    const text = document.getElementById('obsInput').value;
    if (!text.trim()) return;

    try {
        // Normalize whitespace to single spaces
        const normalized = text.replace(/\s+/g, ' ');

        // Detect Semesters First
        // EXECUTE REGEX ON NORMALIZED TEXT, NOT RAW TEXT
        // Regex for Semester Header: YYYY-YYYY (Güz|Bahar|Yaz) Dönemi
        // Broadened to catch "2023-2024 Akademik Yılı Güz Dönemi" if needed, but usually it's simpler.
        const semesterRegex = /(\d{4}-\d{4}\s+.*?\s+Dönemi)/gi;

        let semesterMatches = [];
        let sMatch;
        while ((sMatch = semesterRegex.exec(normalized)) !== null) {
            semesterMatches.push({
                name: sMatch[1],
                index: sMatch.index
            });
        }

        // Regex for courses (existing)
        // Ensure \b is used correctly.
        const regex = /\b(\d{7})\b.*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\b\d{7}\b|$)/g;

        let match;
        let newCourses = [];

        while ((match = regex.exec(normalized)) !== null) {
            const courseIndex = match.index;

            // Determine Semester
            // Logic: Find the latest header that is BEFORE this course.
            let currentParsingSemester = "Genel";

            if (semesterMatches.length > 0) {
                // strict < courseIndex check
                const precedingSemesters = semesterMatches.filter(s => s.index < courseIndex);
                if (precedingSemesters.length > 0) {
                    // The last one in the list is the closest one before the course
                    const prevSem = precedingSemesters[precedingSemesters.length - 1];
                    currentParsingSemester = prevSem.name;
                }
            }

            const courseCode = match[1];
            // Filter out false positives
            const courseName = match[3].trim();
            const courseCredit = match[4];

            if (courseName.includes("Dönem") || courseName.includes("Ortalama") || courseName.includes("Genel")) {
                continue;
            }

            const restOfBlock = match[5];

            let vize = "";
            let final = "";

            // Parse Vize and Final strictly, allowing for negative numbers
            const vizeMatchStrict = restOfBlock.match(/Vize\s+(-?\d+)/i);
            if (vizeMatchStrict) vize = vizeMatchStrict[1];

            const finalMatchStrict = restOfBlock.match(/Final\s+(-?\d+)/i);
            if (finalMatchStrict) final = finalMatchStrict[1];

            // Convert -1 to 0 (Missing grade in OBS)
            if (vize === "-1") vize = "0";
            if (final === "-1") final = "0";

            newCourses.push({
                id: Date.now() + Math.random(),
                name: courseName,
                credit: courseCredit,
                vize: vize,
                final: final,
                semester: currentParsingSemester
            });
        }

        if (newCourses.length > 0) {
            state.courses = newCourses;
            // Update semesters list
            let foundSemesters = [...new Set(newCourses.map(c => c.semester))];

            // Ensure Genel is always first
            if (foundSemesters.includes('Genel')) {
                foundSemesters = foundSemesters.filter(s => s !== 'Genel');
            }
            foundSemesters.unshift('Genel');

            state.semesters = foundSemesters;
            if (state.semesters.length > 0) {
                // If we have multiple semesters and the first is Genel (which might be empty),
                // select the second one (the actual imported semester).
                if (state.semesters.length > 1 && state.semesters[0] === 'Genel') {
                    state.currentSemester = state.semesters[1];
                } else {
                    state.currentSemester = state.semesters[0];
                }
            }

            saveState();
            closeModal();
            render(); // Refresh all
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
    renderSidebar(); // Update sidebar

    const tbody = document.getElementById('courseTableBody');
    tbody.innerHTML = '';

    // Filter courses by current semester
    // Filter courses by current semester
    // If 'Genel', show all courses (View All mode)
    const visibleCourses = state.currentSemester === 'Genel'
        ? state.courses
        : state.courses.filter(c => c.semester === state.currentSemester);

    visibleCourses.forEach((course) => {
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
