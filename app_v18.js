/**
 * KTÜN Not Hesaplayıcı (2026-2027 Yönetmeliği Uyumlu)
 * 10 Temmuz 2026 tarihli ve 33306 sayılı Resmî Gazete değişikliğine göre güncellenmiştir.
 */

const SCALE_2026 = [
    { min: 90, max: 100, letter: 'AA', ects: 'A', coeff: 4.00, category: 'pass' },
    { min: 82, max: 89, letter: 'BA', ects: 'B', coeff: 3.50, category: 'pass' },
    { min: 75, max: 81, letter: 'BB', ects: 'C', coeff: 3.00, category: 'pass' },
    { min: 67, max: 74, letter: 'CB', ects: 'D', coeff: 2.50, category: 'pass' },
    { min: 60, max: 66, letter: 'CC', ects: 'E', coeff: 2.00, category: 'pass' },
    { min: 50, max: 59, letter: 'DC', ects: 'FX', coeff: 1.50, category: 'cond' },
    { min: 45, max: 49, letter: 'DD', ects: 'FX', coeff: 1.00, category: 'cond' },
    { min: 0, max: 44, letter: 'FF', ects: 'F', coeff: 0.00, category: 'fail' }
];

const SCALE_LEGACY = [
    { min: 82, max: 100, letter: 'AA', ects: 'A', coeff: 4.00, category: 'pass' },
    { min: 74, max: 81, letter: 'BA', ects: 'B', coeff: 3.50, category: 'pass' },
    { min: 65, max: 73, letter: 'BB', ects: 'C', coeff: 3.00, category: 'pass' },
    { min: 58, max: 64, letter: 'CB', ects: 'D', coeff: 2.50, category: 'pass' },
    { min: 50, max: 57, letter: 'CC', ects: 'E', coeff: 2.00, category: 'pass' },
    { min: 40, max: 49, letter: 'DC', ects: 'FX', coeff: 1.50, category: 'cond' },
    { min: 35, max: 39, letter: 'DD', ects: 'FX', coeff: 1.00, category: 'cond' },
    { min: 25, max: 34, letter: 'FD', ects: 'F', coeff: 0.50, category: 'fail' },
    { min: 0, max: 24, letter: 'FF', ects: 'F', coeff: 0.00, category: 'fail' }
];

const DEFAULT_SETTINGS_2026 = {
    vizeRatio: 40,
    finalRatio: 60,
    passGrade: 60,
    condGrade: 45,
    finalThreshold: 35,
    condYanoThreshold: 2.50,
    privacyMode: false,
    privacyThreshold: 50
};

const DEFAULT_SETTINGS_LEGACY = {
    vizeRatio: 40,
    finalRatio: 60,
    passGrade: 50,
    condGrade: 40,
    finalThreshold: 35,
    condYanoThreshold: 2.50,
    privacyMode: false,
    privacyThreshold: 50
};

const STORAGE_KEY_V2 = 'gradeCalcData_v2';
const STORAGE_KEY_V1 = 'gradeCalcData_v1';
const THEME_STORAGE_KEY = 'ktunTheme';

let _idSeq = 1;

function nextCourseId() {
    return _idSeq++;
}

function sanitizeCourseIds(courses) {
    if (!Array.isArray(courses)) return [];
    const used = new Set();
    let maxId = 0;

    courses.forEach(c => {
        const num = Number(c.id);
        if (Number.isInteger(num) && num > 0 && !used.has(num)) {
            c.id = num;
            used.add(num);
            if (num > maxId) maxId = num;
        } else {
            c.id = null;
        }
    });

    _idSeq = Math.max(_idSeq, maxId + 1);

    courses.forEach(c => {
        if (c.id === null) {
            c.id = nextCourseId();
        }
    });

    return courses;
}

let state = {
    regulationMode: 'auto', // OBS'ten geçmiş dönem varsa <2026 eski, diğer durumlarda yeni 2026-2027 sistemi
    settings: { ...DEFAULT_SETTINGS_2026 },
    courses: [],
    currentSemester: 'Genel',
    semesters: ['Genel']
};

/**
 * Güvenli HTML kaçış ve sayı yardımcıları
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseInputFloat(val) {
    if (val === null || val === undefined || val === '') return NaN;
    const normalized = String(val).trim().replace(',', '.');
    if (normalized === '') return NaN;
    return parseFloat(normalized);
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isGradeHidden(numVal, settings) {
    if (!settings || !settings.privacyMode) return false;
    if (typeof numVal !== 'number' || isNaN(numVal)) return false;
    const threshold = settings.privacyThreshold !== undefined ? Number(settings.privacyThreshold) : 50;
    return numVal < threshold;
}

/**
 * Yönetmelik modu çözümleme ve harf notu dönüşümü
 */
function resolveEffectiveMode(semesterName, regulationMode) {
    if (regulationMode === 'legacy') return 'legacy';
    if (regulationMode === 'new' || !regulationMode) return 'new';

    if (semesterName && typeof semesterName === 'string') {
        const m = semesterName.match(/(\d{4})\s*-\s*(\d{4})/);
        if (m) {
            const startYear = parseInt(m[1], 10);
            if (!isNaN(startYear) && startYear < 2026) {
                return 'legacy';
            }
        }
    }
    return 'new';
}

function getGradeFromScore(score, mode = 'new') {
    const scale = mode === 'legacy' ? SCALE_LEGACY : SCALE_2026;
    const rounded = Math.max(0, Math.min(100, Math.round(score)));

    for (let i = 0; i < scale.length; i++) {
        const entry = scale[i];
        if (rounded >= entry.min && rounded <= entry.max) {
            return {
                letter: entry.letter,
                ects: entry.ects,
                coeff: entry.coeff,
                category: entry.category
            };
        }
    }
    return { letter: 'FF', ects: 'F', coeff: 0.00, category: 'fail' };
}

function getCoefficient(score, mode = 'new') {
    return getGradeFromScore(score, mode);
}

function formatNeeded(s, baraj) {
    if (!isFinite(s)) return '>100';
    const val = Math.ceil(s);
    if (val > 100) return '>100';
    if (val < baraj) return `${baraj} (Baraj)`;
    return String(val);
}

/**
 * Tüm dönemler için YANO, GANO, AKTS ve üstten ders uygunluğu hesaplaması
 */
function computeAllStats(courses, settings, regulationMode) {
    const mRatio = (Number(settings.vizeRatio) || 0) / 100;
    const fRatio = (Number(settings.finalRatio) || 0) / 100;
    const finalBaraj = settings.finalThreshold !== undefined ? Number(settings.finalThreshold) : 35;
    const yanoLimit = settings.condYanoThreshold !== undefined ? Number(settings.condYanoThreshold) : 2.50;

    const bySemester = {};
    const semesterOrder = [];

    (courses || []).forEach(c => {
        const sem = c.semester || 'Genel';
        if (!bySemester[sem]) {
            bySemester[sem] = {
                semester: sem,
                effectiveMode: resolveEffectiveMode(sem, regulationMode),
                registeredAkts: 0,
                gradedPreviewCredits: 0,
                weighted100: 0,
                completedCredits: 0,
                weightedGpa: 0,
                hasCompleted: false,
                avg100: 0,
                yano: null,
                dcDdPassed: false,
                aktsExceeded: false,
                hasFailed: false,
                courseCount: 0,
                completedCount: 0,
                dcDdCount: 0
            };
            semesterOrder.push(sem);
        }

        const bucket = bySemester[sem];
        bucket.courseCount += 1;

        const credit = parseInputFloat(c.credit);
        const validCredit = !isNaN(credit) && credit > 0 ? credit : 0;
        const v = parseInputFloat(c.vize);
        const f = parseInputFloat(c.final);

        if (validCredit > 0) {
            bucket.registeredAkts += validCredit;
        }

        if (!isNaN(v)) {
            const effectiveFinal = isNaN(f) ? v : f;
            const previewAvg = (v * mRatio) + (effectiveFinal * fRatio);
            if (validCredit > 0) {
                bucket.weighted100 += previewAvg * validCredit;
                bucket.gradedPreviewCredits += validCredit;
            }
        }

        if (!isNaN(v) && !isNaN(f)) {
            const avg = (v * mRatio) + (f * fRatio);
            const gInfo = f < finalBaraj
                ? { letter: 'FF', ects: 'F', coeff: 0.00, category: 'fail' }
                : getGradeFromScore(Math.round(avg), bucket.effectiveMode);

            if (gInfo.letter === 'DC' || gInfo.letter === 'DD') {
                bucket.dcDdCount += 1;
            }

            if (validCredit > 0) {
                bucket.weightedGpa += gInfo.coeff * validCredit;
                bucket.completedCredits += validCredit;
                bucket.completedCount += 1;
                bucket.hasCompleted = true;
            }
        }
    });

    let overallWeighted100 = 0;
    let overallPreviewCredits = 0;
    let overallWeightedGpa = 0;
    let overallCompletedCredits = 0;
    let overallRegisteredAkts = 0;
    let anyFailed = false;
    let anyLegacyCourses = false;

    semesterOrder.forEach(sem => {
        const bucket = bySemester[sem];
        bucket.avg100 = bucket.gradedPreviewCredits > 0
            ? bucket.weighted100 / bucket.gradedPreviewCredits
            : 0;
        bucket.yano = bucket.completedCredits > 0
            ? bucket.weightedGpa / bucket.completedCredits
            : null;
        bucket.dcDdPassed = bucket.yano !== null && round2(bucket.yano) >= round2(yanoLimit);
        bucket.aktsExceeded = bucket.registeredAkts > 45;

        overallWeighted100 += bucket.weighted100;
        overallPreviewCredits += bucket.gradedPreviewCredits;
        overallWeightedGpa += bucket.weightedGpa;
        overallCompletedCredits += bucket.completedCredits;
        overallRegisteredAkts += bucket.registeredAkts;

        const m = sem.match(/(\d{4})\s*-\s*(\d{4})/);
        if (m && parseInt(m[1], 10) < 2026) {
            anyLegacyCourses = true;
        }
    });

    (courses || []).forEach(c => {
        const sem = c.semester || 'Genel';
        const bucket = bySemester[sem];
        const v = parseInputFloat(c.vize);
        const f = parseInputFloat(c.final);
        if (isNaN(v) || isNaN(f)) return;

        if (f < finalBaraj) {
            bucket.hasFailed = true;
            anyFailed = true;
            return;
        }

        const avg = (v * mRatio) + (f * fRatio);
        const gInfo = getGradeFromScore(Math.round(avg), bucket.effectiveMode);

        if (gInfo.category === 'fail') {
            bucket.hasFailed = true;
            anyFailed = true;
        } else if (gInfo.category === 'cond' && bucket.effectiveMode === 'new') {
            if (bucket.yano !== null && round2(bucket.yano) < round2(yanoLimit)) {
                bucket.hasFailed = true;
                anyFailed = true;
            }
        }
    });

    const overallHasCompleted = overallCompletedCredits > 0;
    const gano = overallHasCompleted ? overallWeightedGpa / overallCompletedCredits : null;
    const overallAvg100 = overallPreviewCredits > 0 ? overallWeighted100 / overallPreviewCredits : 0;
    const upperYearEligible = overallHasCompleted && round2(gano) >= 3.00 && !anyFailed;

    return {
        bySemester,
        overall: {
            avg100: overallAvg100,
            gano,
            hasCompleted: overallHasCompleted,
            totalAkts: overallRegisteredAkts,
            completedCredits: overallCompletedCredits,
            anyFailed,
            upperYearEligible,
            anyLegacyCourses
        }
    };
}

/**
 * Tek ders durum & hedef analizi
 */
function calculateStatus(course, stats, settings, regulationMode, options = {}) {
    const semName = course.semester || 'Genel';
    const effectiveMode = resolveEffectiveMode(semName, regulationMode);
    const semStats = stats && stats.bySemester ? stats.bySemester[semName] : null;

    const mRatio = (Number(settings.vizeRatio) || 0) / 100;
    const fRatio = (Number(settings.finalRatio) || 0) / 100;
    const finalBaraj = settings.finalThreshold !== undefined ? Number(settings.finalThreshold) : 35;
    const yanoLimit = settings.condYanoThreshold !== undefined ? Number(settings.condYanoThreshold) : 2.50;
    const privacyActive = Boolean(settings && settings.privacyMode);
    const privacyThreshold = settings && settings.privacyThreshold !== undefined ? Number(settings.privacyThreshold) : 50;

    const rawPass = settings.passGrade !== undefined ? Number(settings.passGrade) : DEFAULT_SETTINGS_2026.passGrade;
    const rawCond = settings.condGrade !== undefined ? Number(settings.condGrade) : DEFAULT_SETTINGS_2026.condGrade;
    const isUsingDefault2026 = rawPass === DEFAULT_SETTINGS_2026.passGrade && rawCond === DEFAULT_SETTINGS_2026.condGrade;
    const defaultPass = effectiveMode === 'legacy' ? 50 : 60;
    const defaultCond = effectiveMode === 'legacy' ? 40 : 45;
    const pLimit = isUsingDefault2026 ? defaultPass : rawPass;
    const cLimit = isUsingDefault2026 ? defaultCond : rawCond;
    const isCustomThresholds = !isUsingDefault2026;

    const v = parseInputFloat(course.vize);
    const f = parseInputFloat(course.final);

    if (isNaN(v)) {
        return '<span class="status-empty">Vize notu bekleniyor…</span>';
    }

    const semTag = options.showSemesterTag && semName !== 'Genel'
        ? `<div class="course-sem-tag">${escapeHtml(semName)}</div>`
        : '';

    // Sadece vize girilmiş (Tahmin Modu)
    if (isNaN(f)) {
        if (fRatio <= 0) {
            return `${semTag}<div class="status-badge-row"><span class="badge badge-warn">Final etki oranı 0%</span></div>`;
        }

        const currentPoints = v * mRatio;
        const neededPass = (pLimit - currentPoints) / fRatio;
        const passStr = formatNeeded(neededPass, finalBaraj);
        const pClass = passStr === '>100' ? 'status-fail' : 'status-pass';

        let predictHtml = '';
        if (effectiveMode === 'new') {
            const neededDC = (50 - currentPoints) / fRatio;
            const neededDD = (cLimit - currentPoints) / fRatio;
            const dcStr = formatNeeded(neededDC, finalBaraj);
            const ddStr = formatNeeded(neededDD, finalBaraj);
            const dcClass = dcStr === '>100' ? 'status-fail' : 'status-cond';
            const ddClass = ddStr === '>100' ? 'status-fail' : 'status-cond';

            let yanoHint = `YANO ≥ ${yanoLimit.toFixed(2)} şartı`;
            if (semStats && semStats.yano !== null) {
                yanoHint = round2(semStats.yano) >= round2(yanoLimit)
                    ? `YANO ${round2(semStats.yano).toFixed(2)} ≥ ${yanoLimit.toFixed(2)} ✓`
                    : `YANO ${round2(semStats.yano).toFixed(2)} < ${yanoLimit.toFixed(2)}`;
            }

            predictHtml = `
                <div class="predict-line">
                    <span>Normal (CC): <strong class="${pClass}">${passStr}</strong></span>
                    <span class="predict-sep">·</span>
                    <span>DC: <strong class="${dcClass}">${dcStr}</strong></span>
                    <span class="predict-sep">·</span>
                    <span>DD: <strong class="${ddClass}">${ddStr}</strong></span>
                </div>
                <div class="predict-hint">DC/DD için: ${yanoHint}</div>
            `;
        } else {
            const neededCond = (cLimit - currentPoints) / fRatio;
            const condStr = formatNeeded(neededCond, finalBaraj);
            const cClass = condStr === '>100' ? 'status-fail' : 'status-cond';
            predictHtml = `
                <div class="predict-line">
                    <span>Normal: <strong class="${pClass}">${passStr}</strong></span>
                    <span class="predict-sep">|</span>
                    <span>Şartlı: <strong class="${cClass}">${condStr}</strong></span>
                </div>
            `;
        }

        const scale = effectiveMode === 'legacy' ? SCALE_LEGACY : SCALE_2026;
        let targetsHtml = '';
        scale.forEach(entry => {
            if (entry.category === 'fail') return;
            let req = Math.ceil((entry.min - currentPoints) / fRatio);
            if (req < finalBaraj) req = finalBaraj;
            if (req <= 100) {
                targetsHtml += `<div class="target-item"><span class="t-lbl">${entry.letter}</span><span>${req}</span></div>`;
            }
        });

        const gridHtml = targetsHtml ? `<div class="target-grid">${targetsHtml}</div>` : '';

        if (privacyActive && v < privacyThreshold) {
            return `${semTag}
                <div class="result-bottom">
                    <span class="status-badge badge-masked">Gizli (&lt; ${privacyThreshold})</span>
                </div>
                <details class="target-details privacy-peek">
                    <summary>Hedef analizi gizli (görmek için tıkla)</summary>
                    ${predictHtml}${gridHtml}
                </details>`;
        }

        const detailsHtml = targetsHtml
            ? `<details class="target-details">
                    <summary>Tüm Harf Hedefleri</summary>
                    ${gridHtml}
               </details>`
            : '';

        return `${semTag}${predictHtml}${detailsHtml}`;
    }

    // Vize ve Final girilmiş (Kesinleşmiş Not Modu)
    const avg = (v * mRatio) + (f * fRatio);
    const roundedAvg = Math.round(avg);

    let gInfo;
    let statusText;
    let badgeClass;
    let barajFailed = false;

    if (f < finalBaraj) {
        barajFailed = true;
        gInfo = { letter: 'FF', ects: 'F', coeff: 0.00, category: 'fail' };
        statusText = `KALDI · Baraj (< ${finalBaraj})`;
        badgeClass = 'badge-fail';
    } else {
        gInfo = getGradeFromScore(roundedAvg, effectiveMode);

        if (!isCustomThresholds) {
            if (gInfo.category === 'pass') {
                statusText = 'GEÇTİ';
                badgeClass = 'badge-pass';
            } else if (gInfo.category === 'cond') {
                if (effectiveMode === 'new') {
                    if (!semStats || semStats.yano === null) {
                        statusText = `ŞARTLI (AKTS girin · YANO ≥ ${yanoLimit.toFixed(2)})`;
                        badgeClass = 'badge-cond';
                    } else if (round2(semStats.yano) >= round2(yanoLimit)) {
                        statusText = `GEÇTİ (Şartlı · YANO ${round2(semStats.yano).toFixed(2)})`;
                        badgeClass = 'badge-pass';
                    } else {
                        statusText = `KALDI (Şartlı · YANO ${round2(semStats.yano).toFixed(2)} < ${yanoLimit.toFixed(2)})`;
                        badgeClass = 'badge-fail';
                    }
                } else {
                    statusText = 'ŞARTLI';
                    badgeClass = 'badge-cond';
                }
            } else {
                statusText = 'KALDI';
                badgeClass = 'badge-fail';
            }
        } else {
            if (roundedAvg >= pLimit) {
                statusText = 'GEÇTİ';
                badgeClass = 'badge-pass';
            } else if (roundedAvg >= cLimit) {
                if (effectiveMode === 'new') {
                    if (!semStats || semStats.yano === null) {
                        statusText = `ŞARTLI (AKTS girin · YANO ≥ ${yanoLimit.toFixed(2)})`;
                        badgeClass = 'badge-cond';
                    } else if (round2(semStats.yano) >= round2(yanoLimit)) {
                        statusText = `GEÇTİ (Şartlı · YANO ${round2(semStats.yano).toFixed(2)})`;
                        badgeClass = 'badge-pass';
                    } else {
                        statusText = `KALDI (Şartlı · YANO ${round2(semStats.yano).toFixed(2)} < ${yanoLimit.toFixed(2)})`;
                        badgeClass = 'badge-fail';
                    }
                } else {
                    statusText = 'ŞARTLI';
                    badgeClass = 'badge-cond';
                }
            } else {
                statusText = 'KALDI';
                badgeClass = 'badge-fail';
            }
        }
    }

    const shouldHideResult = privacyActive && (avg < privacyThreshold || (barajFailed && f < privacyThreshold));
    if (shouldHideResult) {
        return `
            ${semTag}
            <div class="result-top">
                <span class="result-avg masked-pill">Ort: <strong>••</strong></span>
                <span class="grade-pill grade-masked-pill">••</span>
            </div>
            <div class="result-bottom">
                <span class="status-badge badge-masked">Gizli (&lt; ${privacyThreshold})</span>
            </div>
        `;
    }

    const gradeColorClass = getGradeBadgeClass(gInfo.letter, badgeClass);
    const upgradeHint = effectiveMode === 'new' && !barajFailed && gInfo.coeff < 3.00
        ? `<div class="upgrade-hint">Yükseltme alınabilir (&lt; BB)</div>`
        : '';

    return `
        ${semTag}
        <div class="result-top">
            <span class="result-avg">Ort: <strong>${avg.toFixed(2)}</strong></span>
            <span class="grade-pill ${gradeColorClass}">${gInfo.letter} · ${gInfo.coeff.toFixed(2)}</span>
            <span class="ects-chip">ECTS: ${gInfo.ects}</span>
        </div>
        <div class="result-bottom">
            <span class="status-badge ${badgeClass}">${statusText}</span>
            ${upgradeHint}
        </div>
    `;
}

function getGradeBadgeClass(letter, statusBadgeClass) {
    if (letter === 'AA' || letter === 'BA' || letter === 'BB') return 'grade-high';
    if (letter === 'CB' || letter === 'CC') return 'grade-mid';
    if (letter === 'DC' || letter === 'DD') {
        if (statusBadgeClass === 'badge-pass') return 'grade-cond-pass';
        if (statusBadgeClass === 'badge-fail') return 'grade-fail';
        return 'grade-cond';
    }
    return 'grade-fail';
}

/**
 * OBS metni ayrıştırma (saf fonksiyon — test edilebilir)
 */
function parseOBSText(text) {
    if (!text || !text.trim()) {
        return { courses: [], semesters: [], hasLegacySemesters: false };
    }

    const normalized = text.replace(/\s+/g, ' ');
    const semesterRegex = /(\d{4}-\d{4}\s+.*?\s+Dönemi)/gi;
    const semesterMatches = [];
    let sMatch;
    while ((sMatch = semesterRegex.exec(normalized)) !== null) {
        semesterMatches.push({
            name: sMatch[1].trim(),
            index: sMatch.index
        });
    }

    const regex = /\b(\d{7})\b.*?(20\d\d)\s+(.+?)\s+(\d{1,2})\s+(.*?)(?=\b\d{7}\b|$)/g;
    let match;
    const newCourses = [];

    while ((match = regex.exec(normalized)) !== null) {
        const courseIndex = match.index;
        let currentParsingSemester = 'Genel';

        if (semesterMatches.length > 0) {
            const preceding = semesterMatches.filter(s => s.index < courseIndex);
            if (preceding.length > 0) {
                currentParsingSemester = preceding[preceding.length - 1].name;
            }
        }

        const courseName = match[3].trim();
        const courseCredit = match[4];

        if (courseName.includes('Dönem') || courseName.includes('Ortalama') || courseName.includes('Genel')) {
            continue;
        }

        const restOfBlock = match[5];
        let vize = '';
        let final = '';

        const vizeMatch = restOfBlock.match(/Vize\s+(-?\d+(?:[.,]\d+)?)/i);
        if (vizeMatch) vize = vizeMatch[1];

        const finalMatch = restOfBlock.match(/Final\s+(-?\d+(?:[.,]\d+)?)/i);
        if (finalMatch) final = finalMatch[1];

        const butMatch = restOfBlock.match(/B[üu]t(?:[üu]nleme)?\s+(-?\d+(?:[.,]\d+)?)/i);
        if (butMatch && butMatch[1] !== '-1') {
            final = butMatch[1];
        }

        if (vize === '-1') vize = '0';
        if (final === '-1') final = '0';

        newCourses.push({
            id: nextCourseId(),
            name: courseName,
            credit: courseCredit,
            vize,
            final,
            semester: currentParsingSemester
        });
    }

    let foundSemesters = [...new Set(newCourses.map(c => c.semester))];
    foundSemesters = foundSemesters.filter(s => s !== 'Genel');
    foundSemesters.unshift('Genel');

    const hasLegacySemesters = foundSemesters.some(s => {
        const m = s.match(/(\d{4})\s*-\s*(\d{4})/);
        return m && parseInt(m[1], 10) < 2026;
    });

    return { courses: newCourses, semesters: foundSemesters, hasLegacySemesters };
}

/**
 * DOM & Uygulama Yaşam Döngüsü
 */
function applyTheme(theme) {
    if (typeof document === 'undefined') return;
    const target = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = target === 'dark' ? '☀ Açık Tema' : '🌙 Gece Modu';
        btn.setAttribute('aria-label', target === 'dark' ? 'Açık temaya geç' : 'Gece moduna geç');
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
}

function updatePrivacyButton() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('privacyToggleBtn');
    if (!btn) return;
    const active = Boolean(state.settings && state.settings.privacyMode);
    const threshold = state.settings && state.settings.privacyThreshold !== undefined
        ? Number(state.settings.privacyThreshold)
        : 50;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.textContent = active ? `🙈 Gizlilik: Açık (< ${threshold})` : '👁 Gizlilik Modu';
}

function togglePrivacyMode() {
    state.settings.privacyMode = !state.settings.privacyMode;
    updatePrivacyButton();
    saveState();
}

function syncSettingsInputs() {
    const map = {
        vizeRatio: state.settings.vizeRatio,
        finalRatio: state.settings.finalRatio,
        passGrade: state.settings.passGrade,
        condGrade: state.settings.condGrade,
        finalThreshold: state.settings.finalThreshold,
        condYanoThreshold: state.settings.condYanoThreshold,
        privacyThreshold: state.settings.privacyThreshold
    };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = map[id];
    });
    updatePrivacyButton();
}

function init() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    applyTheme(savedTheme);

    const savedV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (savedV2) {
        try {
            const parsed = JSON.parse(savedV2);
            state = {
                regulationMode: 'auto',
                settings: { ...DEFAULT_SETTINGS_2026, ...(parsed.settings || {}) },
                courses: sanitizeCourseIds(Array.isArray(parsed.courses) ? parsed.courses : []),
                currentSemester: parsed.currentSemester || 'Genel',
                semesters: Array.isArray(parsed.semesters) && parsed.semesters.length > 0 ? parsed.semesters : ['Genel']
            };
        } catch (e) {
            console.error('v2 save data mismatch', e);
            if (state.courses.length === 0) addCourse(false);
        }
    } else {
        const savedV1 = localStorage.getItem(STORAGE_KEY_V1);
        if (savedV1) {
            try {
                const legacyData = JSON.parse(savedV1);
                state = {
                    regulationMode: 'auto',
                    settings: { ...DEFAULT_SETTINGS_2026 },
                    courses: sanitizeCourseIds(Array.isArray(legacyData.courses) ? legacyData.courses : []),
                    currentSemester: legacyData.currentSemester || 'Genel',
                    semesters: Array.isArray(legacyData.semesters) && legacyData.semesters.length > 0 ? legacyData.semesters : ['Genel']
                };
                if (state.courses.length === 0) {
                    addCourse(false);
                }
                localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
            } catch (e) {
                console.error('v1 migration error', e);
                addCourse(false);
            }
        } else {
            addCourse(false);
        }
    }

    syncSettingsInputs();
    render();
}

function saveState(shouldRender = true) {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
    const saveMsg = document.getElementById('saveMsg');
    if (saveMsg) {
        saveMsg.style.opacity = '1';
        setTimeout(() => {
            saveMsg.style.opacity = '0';
        }, 1200);
    }
    if (shouldRender) render();
}

function resetSettingsToDefault() {
    const keepPrivacyMode = Boolean(state.settings.privacyMode);
    state.settings = { ...DEFAULT_SETTINGS_2026, privacyMode: keepPrivacyMode };
    syncSettingsInputs();
    saveState();
}

function updateSettings() {
    const vizeVal = parseInputFloat(document.getElementById('vizeRatio').value);
    const finalVal = parseInputFloat(document.getElementById('finalRatio').value);
    const passVal = parseInputFloat(document.getElementById('passGrade').value);
    const condVal = parseInputFloat(document.getElementById('condGrade').value);
    const thresholdVal = parseInputFloat(document.getElementById('finalThreshold').value);
    const yanoEl = document.getElementById('condYanoThreshold');
    const yanoVal = yanoEl ? parseInputFloat(yanoEl.value) : 2.50;
    const privacyEl = document.getElementById('privacyThreshold');
    const privacyVal = privacyEl ? parseInputFloat(privacyEl.value) : 50;

    state.settings.vizeRatio = isNaN(vizeVal) ? 40 : vizeVal;
    state.settings.finalRatio = isNaN(finalVal) ? 60 : finalVal;
    state.settings.passGrade = isNaN(passVal) ? 60 : passVal;
    state.settings.condGrade = isNaN(condVal) ? 45 : condVal;
    state.settings.finalThreshold = isNaN(thresholdVal) ? 35 : thresholdVal;
    state.settings.condYanoThreshold = isNaN(yanoVal) ? 2.50 : Math.max(0, Math.min(4, yanoVal));
    state.settings.privacyThreshold = isNaN(privacyVal) ? 50 : Math.max(0, Math.min(100, privacyVal));

    updatePrivacyButton();
    saveState();
}

function addCourse(save = true) {
    state.courses.push({
        id: nextCourseId(),
        name: '',
        credit: '',
        vize: '',
        final: '',
        semester: state.currentSemester || 'Genel'
    });
    if (save) saveState();
}

function removeCourse(id) {
    state.courses = state.courses.filter(c => c.id !== id);
    saveState();
}

function clearAll() {
    if (confirm('Tüm dersler ve dönem verileri silinecek. Emin misiniz?')) {
        state.courses = [];
        state.semesters = ['Genel'];
        state.currentSemester = 'Genel';
        addCourse(false);
        saveState();
    }
}

function validateInput(el, min = 0, max = 100) {
    if (el.value === '') return NaN;
    let val = parseInputFloat(el.value);
    if (isNaN(val)) return NaN;
    if (val < min) {
        el.value = min;
        val = min;
    }
    if (val > max) {
        el.value = max;
        val = max;
    }
    return val;
}

function syncInputMask(inputEl, field, course) {
    if (!inputEl || !course || (field !== 'vize' && field !== 'final')) return;
    const num = parseInputFloat(course[field]);
    const masked = isGradeHidden(num, state.settings);

    if (masked) {
        inputEl.setAttribute('type', 'password');
        inputEl.setAttribute('inputmode', 'decimal');
        inputEl.removeAttribute('step');
        inputEl.removeAttribute('min');
        inputEl.removeAttribute('max');
        inputEl.classList.add('grade-masked');
    } else {
        inputEl.setAttribute('type', 'number');
        inputEl.setAttribute('step', 'any');
        inputEl.setAttribute('min', '0');
        inputEl.setAttribute('max', '100');
        inputEl.removeAttribute('inputmode');
        inputEl.classList.remove('grade-masked');
    }
}

function updateCourseData(id, field, value) {
    const course = state.courses.find(c => c.id === id);
    if (!course) return;

    course[field] = value;
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));

    if (field === 'name') return;

    const stats = computeAllStats(state.courses, state.settings, state.regulationMode);
    const visibleCourses = getVisibleCourses();
    const showSemTag = state.currentSemester === 'Genel' && state.semesters.length > 1;

    visibleCourses.forEach(vc => {
        const row = document.querySelector(`tr[data-id="${vc.id}"]`);
        if (!row) return;
        const resultCell = row.querySelector('.result-cell');
        if (!resultCell) return;

        const details = resultCell.querySelector('details');
        const wasOpen = details && details.hasAttribute('open');

        resultCell.innerHTML = calculateStatus(vc, stats, state.settings, state.regulationMode, {
            showSemesterTag: showSemTag
        });

        if (wasOpen) {
            const newDetails = resultCell.querySelector('details');
            if (newDetails) newDetails.setAttribute('open', '');
        }
    });

    updateSummary(stats);
    updateHero(stats);
}

function getVisibleCourses() {
    return state.currentSemester === 'Genel'
        ? state.courses
        : state.courses.filter(c => (c.semester || 'Genel') === state.currentSemester);
}

function updateHero(stats) {
    const titleEl = document.getElementById('activeSemesterTitle');
    if (titleEl) {
        if (state.currentSemester === 'Genel') {
            titleEl.textContent = state.semesters.length > 1 ? 'Genel Akademik Görünüm (Tüm Dönemler)' : 'Aktif Dönem Not Hesaplama';
        } else {
            titleEl.textContent = state.currentSemester;
        }
    }

    const pill = document.getElementById('yanoRulePill');
    if (pill) {
        const isGenel = state.currentSemester === 'Genel';
        const semStats = isGenel ? null : stats.bySemester[state.currentSemester];
        const effectiveMode = isGenel ? 'new' : resolveEffectiveMode(state.currentSemester, state.regulationMode);
        const yanoLimit = state.settings.condYanoThreshold !== undefined ? Number(state.settings.condYanoThreshold) : 2.50;

        pill.className = 'yano-rule-pill';
        if (effectiveMode === 'legacy') {
            pill.classList.add('pill-muted');
            pill.textContent = '2026 Öncesi Dönem · Eski Yönetmelik Skalası Otomatik Uygulandı';
        } else if (isGenel && state.semesters.length > 1) {
            pill.classList.add('pill-info');
            const ganoStr = stats.overall.hasCompleted && stats.overall.gano !== null
                ? round2(stats.overall.gano).toFixed(2)
                : '0.00';
            pill.textContent = stats.overall.anyLegacyCourses
                ? `Döneme Göre Otomatik Sistem · GANO: ${ganoStr}`
                : `2026-2027 Yönetmeliği · GANO: ${ganoStr}`;
        } else {
            const activeYano = isGenel ? stats.overall.gano : (semStats ? semStats.yano : null);
            if (activeYano === null) {
                pill.classList.add('pill-neutral');
                pill.textContent = `DC/DD Şartı: Dönem YANO ≥ ${yanoLimit.toFixed(2)} (Bekleniyor)`;
            } else if (round2(activeYano) >= round2(yanoLimit)) {
                pill.classList.add('pill-pass');
                pill.textContent = `YANO ${round2(activeYano).toFixed(2)} ≥ ${yanoLimit.toFixed(2)} · DC/DD Otomatik Geçer ✓`;
            } else {
                pill.classList.add('pill-fail');
                pill.textContent = `YANO ${round2(activeYano).toFixed(2)} < ${yanoLimit.toFixed(2)} · DC/DD Başarısız ✕`;
            }
        }
    }
}

function updateSummary(stats) {
    const computed = stats || computeAllStats(state.courses, state.settings, state.regulationMode);
    const yanoLimit = state.settings.condYanoThreshold !== undefined ? Number(state.settings.condYanoThreshold) : 2.50;
    const isGenel = state.currentSemester === 'Genel';
    const semStats = !isGenel ? computed.bySemester[state.currentSemester] : null;

    // 1. Dönem Ortalaması (100'lük)
    const termAvgVal = isGenel ? computed.overall.avg100 : (semStats ? semStats.avg100 : 0);
    const termAvgEl = document.getElementById('termAvg');
    if (termAvgEl) termAvgEl.textContent = termAvgVal.toFixed(2);

    const termAvgBadge = document.getElementById('termAvgBadge');
    if (termAvgBadge) {
        termAvgBadge.textContent = `Vize %${state.settings.vizeRatio} · Final %${state.settings.finalRatio} önizleme`;
    }

    // 2. YANO (Dönem 4.00)
    const yanoVal = isGenel ? computed.overall.gano : (semStats ? semStats.yano : null);
    const gpaEl = document.getElementById('gpaValue');
    if (gpaEl) gpaEl.textContent = yanoVal !== null ? round2(yanoVal).toFixed(2) : '0.00';

    const yanoBadgeEl = document.getElementById('yanoBadge');
    if (yanoBadgeEl) {
        if (isGenel && state.semesters.length > 1) {
            yanoBadgeEl.className = 'kpi-badge kpi-neutral';
            yanoBadgeEl.textContent = 'Tüm dönemlerin ortalaması';
        } else {
            const effMode = resolveEffectiveMode(state.currentSemester, state.regulationMode);
            if (effMode === 'legacy') {
                yanoBadgeEl.className = 'kpi-badge kpi-neutral';
                yanoBadgeEl.textContent = 'Eski sistem skalası';
            } else if (yanoVal === null) {
                yanoBadgeEl.className = 'kpi-badge kpi-neutral';
                yanoBadgeEl.textContent = `DC/DD için ≥ ${yanoLimit.toFixed(2)} gerekir`;
            } else if (round2(yanoVal) >= round2(yanoLimit)) {
                yanoBadgeEl.className = 'kpi-badge kpi-pass';
                yanoBadgeEl.textContent = `DC/DD Geçer (≥ ${yanoLimit.toFixed(2)}) ✓`;
            } else {
                yanoBadgeEl.className = 'kpi-badge kpi-fail';
                yanoBadgeEl.textContent = `DC/DD Kalır (< ${yanoLimit.toFixed(2)})`;
            }
        }
    }

    // 3. GANO (Genel 4.00) + Üstten Ders Uygunluğu
    const ganoEl = document.getElementById('ganoValue');
    if (ganoEl) {
        ganoEl.textContent = computed.overall.hasCompleted && computed.overall.gano !== null
            ? round2(computed.overall.gano).toFixed(2)
            : '0.00';
    }

    const ganoBadgeEl = document.getElementById('ganoBadge');
    if (ganoBadgeEl) {
        if (!computed.overall.hasCompleted) {
            ganoBadgeEl.className = 'kpi-badge kpi-neutral';
            ganoBadgeEl.textContent = 'Tamamlanmış ders bekleniyor';
        } else if (computed.overall.upperYearEligible) {
            ganoBadgeEl.className = 'kpi-badge kpi-pass';
            ganoBadgeEl.textContent = 'Üstten ders alabilir (GANO ≥ 3.00) ✓';
        } else if (round2(computed.overall.gano) >= 3.00 && computed.overall.anyFailed) {
            ganoBadgeEl.className = 'kpi-badge kpi-warn';
            ganoBadgeEl.textContent = 'GANO ≥ 3.00 (Alttan başarısız ders var)';
        } else {
            ganoBadgeEl.className = 'kpi-badge kpi-neutral';
            ganoBadgeEl.textContent = 'Üstten ders için GANO ≥ 3.00';
        }
    }

    // 4. AKTS Yükü (45 AKTS / Yarıyıl sınırı)
    const activeAkts = isGenel ? computed.overall.totalAkts : (semStats ? semStats.registeredAkts : 0);
    const totalCreditEl = document.getElementById('totalCredit');
    if (totalCreditEl) {
        totalCreditEl.textContent = Number.isInteger(activeAkts) ? String(activeAkts) : activeAkts.toFixed(1);
    }

    const aktsBar = document.getElementById('aktsBar');
    const aktsBadge = document.getElementById('aktsBadge');
    const isMultiTermGenel = isGenel && state.semesters.length > 1;

    if (aktsBar) {
        const pct = isMultiTermGenel ? 100 : Math.min(100, (activeAkts / 45) * 100);
        aktsBar.style.width = `${pct}%`;
        aktsBar.classList.toggle('over-limit', !isMultiTermGenel && activeAkts > 45);
    }

    if (aktsBadge) {
        if (isMultiTermGenel) {
            aktsBadge.className = 'kpi-badge kpi-neutral';
            aktsBadge.textContent = `${state.semesters.length - 1} dönem toplamı (Yarıyıl sınır: 45)`;
        } else if (activeAkts > 45) {
            aktsBadge.className = 'kpi-badge kpi-fail';
            aktsBadge.textContent = `45 AKTS sınırı aşıldı (${activeAkts}/45)`;
        } else {
            aktsBadge.className = 'kpi-badge kpi-neutral';
            aktsBadge.textContent = `${activeAkts} / 45 AKTS yarıyıl sınırı`;
        }
    }
}

function renderSidebar() {
    const sidebarContainer = document.getElementById('semesterSidebar');
    const listContainer = document.getElementById('semesterList');
    if (!sidebarContainer || !listContainer) return;

    const usedSemesters = new Set(state.courses.map(c => c.semester).filter(Boolean));
    usedSemesters.add('Genel');

    const newSemesters = state.semesters.filter(s => s === 'Genel' || usedSemesters.has(s) || state.semesters.includes(s));
    usedSemesters.forEach(s => {
        if (!newSemesters.includes(s)) newSemesters.push(s);
    });

    const filtered = newSemesters.filter(s => s !== 'Genel');
    filtered.unshift('Genel');
    state.semesters = filtered;

    const isDefaultOnly = state.semesters.length === 1 && state.semesters[0] === 'Genel';
    sidebarContainer.style.display = isDefaultOnly ? 'none' : '';

    listContainer.innerHTML = '';
    state.semesters.forEach(sem => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sidebar-item ${state.currentSemester === sem ? 'active' : ''}`;
        btn.textContent = sem;
        btn.onclick = () => {
            state.currentSemester = sem;
            saveState();
        };
        listContainer.appendChild(btn);
    });
}

function addNewSemester() {
    const name = prompt('Dönem Adı (Örn: 2026-2027 Güz Dönemi):');
    if (name && name.trim()) {
        const clean = name.trim();
        if (!state.semesters.includes(clean)) {
            state.semesters.push(clean);
        }
        state.currentSemester = clean;
        saveState();
    }
}

function parseOBS() {
    const input = document.getElementById('obsInput');
    const text = input ? input.value : '';
    if (!text.trim()) return;

    try {
        const parsed = parseOBSText(text);
        if (parsed.courses.length > 0) {
            state.courses = parsed.courses;
            state.semesters = parsed.semesters;

            if (state.semesters.length > 1 && state.semesters[0] === 'Genel') {
                state.currentSemester = state.semesters[state.semesters.length - 1];
            } else {
                state.currentSemester = state.semesters[0];
            }

            saveState();
            closeModal();
        } else {
            alert('Veri bulunamadı. OBS Not Durumu sayfasındaki tüm metni kopyaladığınızdan emin olun.');
        }
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

function buildGradeInputAttrs(field, rawValue, numVal, placeholder) {
    if (isGradeHidden(numVal, state.settings)) {
        return `type="password" inputmode="decimal" class="grade-masked" data-field="${field}" value="${escapeHtml(rawValue)}" placeholder="${placeholder}"`;
    }
    return `type="number" step="any" min="0" max="100" data-field="${field}" value="${escapeHtml(rawValue)}" placeholder="${placeholder}"`;
}

function render() {
    renderSidebar();

    const stats = computeAllStats(state.courses, state.settings, state.regulationMode);
    const tbody = document.getElementById('courseTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        const visibleCourses = getVisibleCourses();
        const showSemTag = state.currentSemester === 'Genel' && state.semesters.length > 1;

        visibleCourses.forEach(course => {
            const analysisHtml = calculateStatus(course, stats, state.settings, state.regulationMode, {
                showSemesterTag: showSemTag
            });
            const row = document.createElement('tr');
            row.setAttribute('data-id', course.id);

            const vNum = parseInputFloat(course.vize);
            const fNum = parseInputFloat(course.final);
            const vizeAttrs = buildGradeInputAttrs('vize', course.vize, vNum, 'Vize');
            const finalAttrs = buildGradeInputAttrs('final', course.final, fNum, 'Final');

            row.innerHTML = `
                <td data-label="Ders Adı">
                    <input type="text" data-field="name" value="${escapeHtml(course.name)}" placeholder="Ders adı...">
                </td>
                <td data-label="AKTS">
                    <input type="number" step="0.5" min="0" max="30" data-field="credit" value="${escapeHtml(course.credit)}" placeholder="AKTS">
                </td>
                <td data-label="Vize">
                    <input ${vizeAttrs}>
                </td>
                <td data-label="Final">
                    <input ${finalAttrs}>
                </td>
                <td data-label="Durum / Analiz" class="result-cell">${analysisHtml}</td>
                <td data-label="İşlem">
                    <button type="button" class="btn btn-remove" data-action="remove">Sil</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateSummary(stats);
    updateHero(stats);
}

function openObsModal() {
    const modal = document.getElementById('obsModal');
    if (modal) modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('obsModal');
    const input = document.getElementById('obsInput');
    if (modal) modal.classList.remove('active');
    if (input) input.value = '';
}

function openRegModal() {
    const modal = document.getElementById('regulationModal');
    if (modal) modal.classList.add('active');
}

function closeRegModal() {
    const modal = document.getElementById('regulationModal');
    if (modal) modal.classList.remove('active');
}

if (typeof document !== 'undefined') {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    const privacyToggleBtn = document.getElementById('privacyToggleBtn');
    if (privacyToggleBtn) privacyToggleBtn.addEventListener('click', togglePrivacyMode);

    const openObsModalBtn = document.getElementById('openObsModalBtn');
    if (openObsModalBtn) openObsModalBtn.addEventListener('click', openObsModal);

    const tableObsImportBtn = document.getElementById('tableObsImportBtn');
    if (tableObsImportBtn) tableObsImportBtn.addEventListener('click', openObsModal);

    const openRegModalBtn = document.getElementById('openRegModalBtn');
    if (openRegModalBtn) openRegModalBtn.addEventListener('click', openRegModal);

    const closeRegModalBtn = document.getElementById('closeRegModalBtn');
    if (closeRegModalBtn) closeRegModalBtn.addEventListener('click', closeRegModal);

    const addSemesterBtn = document.getElementById('addSemesterBtn');
    if (addSemesterBtn) addSemesterBtn.addEventListener('click', addNewSemester);

    const parseObsBtn = document.getElementById('parseObsBtn');
    if (parseObsBtn) parseObsBtn.addEventListener('click', parseOBS);

    document.querySelectorAll('[data-close-modal="obsModal"]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                if (overlay.id === 'obsModal') closeModal();
                if (overlay.id === 'regulationModal') closeRegModal();
            }
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeRegModal();
        }
    });

    const tbody = document.getElementById('courseTableBody');
    if (tbody) {
        tbody.addEventListener('input', e => {
            const inputEl = e.target;
            const field = inputEl.getAttribute && inputEl.getAttribute('data-field');
            if (!field) return;
            const row = inputEl.closest('tr');
            if (!row) return;
            const courseId = Number(row.getAttribute('data-id'));
            if (!courseId) return;

            if (field === 'credit') validateInput(inputEl, 0, 30);
            else if (field === 'vize' || field === 'final') validateInput(inputEl, 0, 100);

            updateCourseData(courseId, field, inputEl.value);
        });

        tbody.addEventListener('blur', e => {
            const inputEl = e.target;
            const field = inputEl.getAttribute && inputEl.getAttribute('data-field');
            if (field !== 'vize' && field !== 'final') return;
            const row = inputEl.closest('tr');
            if (!row) return;
            const courseId = Number(row.getAttribute('data-id'));
            const course = state.courses.find(c => c.id === courseId);
            if (course) syncInputMask(inputEl, field, course);
        }, true);

        tbody.addEventListener('click', e => {
            const removeBtn = e.target.closest && e.target.closest('[data-action="remove"]');
            if (!removeBtn) return;
            const row = removeBtn.closest('tr');
            if (!row) return;
            const courseId = Number(row.getAttribute('data-id'));
            if (courseId) removeCourse(courseId);
        });
    }

    ['vizeRatio', 'finalRatio', 'passGrade', 'condGrade', 'finalThreshold', 'privacyThreshold'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                validateInput(this, 0, 100);
                updateSettings();
            });
        }
    });

    const yanoInput = document.getElementById('condYanoThreshold');
    if (yanoInput) {
        yanoInput.addEventListener('input', function () {
            validateInput(this, 0, 4);
            updateSettings();
        });
    }

    const addCourseBtn = document.getElementById('addCourseBtn');
    if (addCourseBtn) addCourseBtn.addEventListener('click', () => addCourse());

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', clearAll);

    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetSettingsToDefault);

    const toggleBtn = document.getElementById('toggleSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    if (toggleBtn && settingsPanel) {
        toggleBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('collapsed');
            toggleBtn.textContent = settingsPanel.classList.contains('collapsed')
                ? 'Gelişmiş Ayarları Göster ▲'
                : 'Ayarları Gizle ▼';
        });
    }

    init();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SCALE_2026,
        SCALE_LEGACY,
        DEFAULT_SETTINGS_2026,
        DEFAULT_SETTINGS_LEGACY,
        resolveEffectiveMode,
        getGradeFromScore,
        computeAllStats,
        calculateStatus,
        parseOBSText,
        formatNeeded,
        escapeHtml,
        isGradeHidden,
        round2,
        nextCourseId,
        sanitizeCourseIds
    };
}
