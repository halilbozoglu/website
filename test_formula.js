const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    DEFAULT_SETTINGS_2026,
    resolveEffectiveMode,
    getGradeFromScore,
    computeAllStats,
    calculateStatus,
    parseOBSText,
    formatNeeded,
    isGradeHidden,
    round2,
    sanitizeCourseIds
} = require('./app_v18.js');

// 1. 2026-2027 Harf Notu ve Katsayi Tablo Sinirlari (Md. 15/7)
const boundaryCases2026 = [
    [100, 'AA', 'A', 4.00],
    [90, 'AA', 'A', 4.00],
    [89, 'BA', 'B', 3.50],
    [82, 'BA', 'B', 3.50],
    [81, 'BB', 'C', 3.00],
    [75, 'BB', 'C', 3.00],
    [74, 'CB', 'D', 2.50],
    [67, 'CB', 'D', 2.50],
    [66, 'CC', 'E', 2.00],
    [60, 'CC', 'E', 2.00],
    [59, 'DC', 'FX', 1.50],
    [50, 'DC', 'FX', 1.50],
    [49, 'DD', 'FX', 1.00],
    [45, 'DD', 'FX', 1.00],
    [44, 'FF', 'F', 0.00],
    [0, 'FF', 'F', 0.00]
];

boundaryCases2026.forEach(([score, letter, ects, coeff]) => {
    const res = getGradeFromScore(score, 'new');
    assert.strictEqual(res.letter, letter, `Score ${score} letter mismatch`);
    assert.strictEqual(res.ects, ects, `Score ${score} ECTS mismatch`);
    assert.strictEqual(res.coeff, coeff, `Score ${score} coeff mismatch`);
});

// 2. Yuvarlama Sinirlari
assert.strictEqual(getGradeFromScore(89.5, 'new').letter, 'AA');
assert.strictEqual(getGradeFromScore(89.4, 'new').letter, 'BA');
assert.strictEqual(getGradeFromScore(59.5, 'new').letter, 'CC');
assert.strictEqual(getGradeFromScore(59.4, 'new').letter, 'DC');
assert.strictEqual(getGradeFromScore(44.5, 'new').letter, 'DD');
assert.strictEqual(getGradeFromScore(44.4, 'new').letter, 'FF');

// 3. Final Baraji (< 35 -> FF / 0.00 / KALDI Baraj)
{
    const sem = '2026-2027 Güz Dönemi';
    const courses = [
        { id: 1, name: 'Baraj Dersi', credit: 5, vize: '100', final: '34', semester: sem }
    ];
    const stats = computeAllStats(courses, DEFAULT_SETTINGS_2026, 'new');
    assert.strictEqual(stats.bySemester[sem].yano, 0);
    assert.strictEqual(stats.bySemester[sem].hasFailed, true);

    const html = calculateStatus(courses[0], stats, DEFAULT_SETTINGS_2026, 'new');
    assert(html.includes('FF'), 'Baraj failure must display FF');
    assert(html.includes('KALDI'), 'Baraj failure must display KALDI');
    assert(html.includes('Baraj'), 'Baraj failure must mention Baraj');
}

// 4. Dinamik YANO >= 2.50 ile DC/DD Gecme ve < 2.50 ile Kalma
{
    const sem = '2026-2027 Güz Dönemi';
    // Senaryo A: Yuksek ders (AA 4.0 * 10 = 40) + DC (1.5 * 5 = 7.5) + DD (1.0 * 5 = 5) => 52.5 / 20 = 2.625 >= 2.50
    const passCourses = [
        { id: 1, name: 'Ana Ders', credit: 10, vize: '95', final: '95', semester: sem }, // AA (4.00)
        { id: 2, name: 'DC Ders', credit: 5, vize: '55', final: '55', semester: sem },   // DC (1.50)
        { id: 3, name: 'DD Ders', credit: 5, vize: '46', final: '46', semester: sem }    // DD (1.00)
    ];
    const statsPass = computeAllStats(passCourses, DEFAULT_SETTINGS_2026, 'new');
    assert(statsPass.bySemester[sem].yano >= 2.50, 'Expected YANO >= 2.50');
    assert.strictEqual(statsPass.bySemester[sem].dcDdPassed, true);
    assert.strictEqual(statsPass.bySemester[sem].hasFailed, false);

    const dcPassHtml = calculateStatus(passCourses[1], statsPass, DEFAULT_SETTINGS_2026, 'new');
    const ddPassHtml = calculateStatus(passCourses[2], statsPass, DEFAULT_SETTINGS_2026, 'new');
    assert(dcPassHtml.includes('GEÇTİ'), 'DC should pass when YANO >= 2.50');
    assert(ddPassHtml.includes('GEÇTİ'), 'DD should pass when YANO >= 2.50');

    // Senaryo B: Orta ders (CB 2.5 * 5 = 12.5) + DC (1.5 * 5 = 7.5) + DD (1.0 * 5 = 5) => 25 / 15 = 1.67 < 2.50
    const failCourses = [
        { id: 1, name: 'Orta Ders', credit: 5, vize: '70', final: '70', semester: sem }, // CB (2.50)
        { id: 2, name: 'DC Ders', credit: 5, vize: '55', final: '55', semester: sem },   // DC (1.50)
        { id: 3, name: 'DD Ders', credit: 5, vize: '46', final: '46', semester: sem }    // DD (1.00)
    ];
    const statsFail = computeAllStats(failCourses, DEFAULT_SETTINGS_2026, 'new');
    assert(statsFail.bySemester[sem].yano < 2.50, 'Expected YANO < 2.50');
    assert.strictEqual(statsFail.bySemester[sem].dcDdPassed, false);
    assert.strictEqual(statsFail.bySemester[sem].hasFailed, true);

    const dcFailHtml = calculateStatus(failCourses[1], statsFail, DEFAULT_SETTINGS_2026, 'new');
    const ddFailHtml = calculateStatus(failCourses[2], statsFail, DEFAULT_SETTINGS_2026, 'new');
    assert(dcFailHtml.includes('KALDI'), 'DC should fail when YANO < 2.50');
    assert(ddFailHtml.includes('KALDI'), 'DD should fail when YANO < 2.50');
}

// 5. Auto Mod Cozumleme ve Gercek OBS Verisi Dogrulamasi (test_obs_complex.js)
assert.strictEqual(resolveEffectiveMode('2024-2025 Güz Dönemi', 'auto'), 'legacy');
assert.strictEqual(resolveEffectiveMode('2025-2026 Güz Dönemi', 'auto'), 'legacy');
assert.strictEqual(resolveEffectiveMode('2026-2027 Güz Dönemi', 'auto'), 'new');
assert.strictEqual(resolveEffectiveMode('2024-2025 Güz Dönemi', 'new'), 'new');

{
    const complexFile = fs.readFileSync(path.join(__dirname, 'test_obs_complex.js'), 'utf8');
    const textMatch = complexFile.match(/const text = `([\s\S]*?)`;/);
    assert(textMatch, 'Could not read sample OBS text from test_obs_complex.js');

    const parsed = parseOBSText(textMatch[1]);
    assert.strictEqual(parsed.courses.length, 21, 'Expected 21 parsed courses from test_obs_complex.js');
    assert.strictEqual(parsed.hasLegacySemesters, true, 'Expected legacy semesters detected');
    assert.deepStrictEqual(parsed.semesters, [
        'Genel',
        '2024-2025 Güz Dönemi',
        '2024-2025 Bahar Dönemi',
        '2025-2026 Güz Dönemi'
    ]);

    // 2025-2026 Guz derslerinde Final yok; Vize var
    const guz2526 = parsed.courses.filter(c => c.semester === '2025-2026 Güz Dönemi');
    assert.strictEqual(guz2526.length, 8);
    assert.strictEqual(guz2526[0].final, '');

    // Auto modda 2024-2025 Guz -> 3.03, 2024-2025 Bahar -> 2.70, GANO -> 2.87 (OBS ile birebir)
    const obsStats = computeAllStats(parsed.courses, DEFAULT_SETTINGS_2026, 'auto');
    assert.strictEqual(obsStats.bySemester['2024-2025 Güz Dönemi'].yano.toFixed(2), '3.03');
    assert.strictEqual(obsStats.bySemester['2024-2025 Bahar Dönemi'].yano.toFixed(2), '2.70');
    assert.strictEqual(obsStats.overall.gano.toFixed(2), '2.87');
}

// 6. OBS Ayristirma: -1 -> 0 ve Butunleme Notunun Final Yerine Gecmesi
{
    const sampleWithBut = `
2026-2027 Güz Dönemi
1202301 2027 Devre Analizi I 5 Vize -1 Final 25 Büt 68 41 DC Başarılı
1202302 2027 Fizik I 4 Vize 50 Final -1 30 FF Başarısız
`;
    const parsed = parseOBSText(sampleWithBut);
    assert.strictEqual(parsed.courses.length, 2);
    assert.strictEqual(parsed.courses[0].vize, '0');
    assert.strictEqual(parsed.courses[0].final, '68');
    assert.strictEqual(parsed.courses[1].final, '0');
    assert.strictEqual(parsed.hasLegacySemesters, false);
}

// 7. 45 AKTS Siniri ve GANO >= 3.00 Ustten Ders Uygunlugu (Md. 11)
{
    const sem = '2026-2027 Güz Dönemi';
    const heavyCourses = [
        { id: 1, name: 'D1', credit: 25, vize: '92', final: '92', semester: sem },
        { id: 2, name: 'D2', credit: 22, vize: '90', final: '90', semester: sem }
    ];
    const heavyStats = computeAllStats(heavyCourses, DEFAULT_SETTINGS_2026, 'new');
    assert.strictEqual(heavyStats.bySemester[sem].registeredAkts, 47);
    assert.strictEqual(heavyStats.bySemester[sem].aktsExceeded, true);
    assert.strictEqual(heavyStats.overall.upperYearEligible, true);

    // Basarisiz ders varsa GANO >= 3.00 olsa bile ustten ders alamaz
    const withFail = [
        { id: 1, name: 'D1', credit: 30, vize: '95', final: '95', semester: sem }, // AA (4.0)
        { id: 2, name: 'D2', credit: 3, vize: '30', final: '30', semester: sem }   // FF (0.0)
    ];
    const withFailStats = computeAllStats(withFail, DEFAULT_SETTINGS_2026, 'new');
    assert(withFailStats.overall.gano >= 3.00);
    assert.strictEqual(withFailStats.overall.anyFailed, true);
    assert.strictEqual(withFailStats.overall.upperYearEligible, false);
}

// 8. Tahmin Modu ve formatNeeded
assert.strictEqual(formatNeeded(20, 35), '35 (Baraj)');
assert.strictEqual(formatNeeded(73.2, 35), '74');
assert.strictEqual(formatNeeded(101, 35), '>100');
{
    const sem = '2026-2027 Güz Dönemi';
    const predCourse = { id: 1, name: 'Elektronik', credit: 5, vize: '50', final: '', semester: sem };
    const predStats = computeAllStats([predCourse], DEFAULT_SETTINGS_2026, 'new');
    const predHtml = calculateStatus(predCourse, predStats, DEFAULT_SETTINGS_2026, 'new');
    // CC=60 => (60 - 20)/0.6 = 66.67 => 67
    assert(predHtml.includes('67'), 'Expected needed CC score 67 in prediction HTML');
    // DC=50 => (50 - 20)/0.6 = 50
    assert(predHtml.includes('50'), 'Expected needed DC score 50 in prediction HTML');
    // DD=45 => (45 - 20)/0.6 = 41.67 => 42
    assert(predHtml.includes('42'), 'Expected needed DD score 42 in prediction HTML');
}

// 9. Auto Mod + DEFAULT_SETTINGS_2026 (60/45) ile Eski ve Yeni Donem Durum Regresyonu
{
    const autoCourses = [
        { id: 1, name: 'Fizik I', credit: 6, vize: '45', final: '60', semester: '2024-2025 Güz Dönemi' }, // Ort 54 -> Legacy CC -> GECTI
        { id: 2, name: 'Prog I', credit: 6, vize: '32', final: '53', semester: '2024-2025 Bahar Dönemi' }, // Ort 44.6 (45) -> Legacy DC -> SARTLI
        { id: 3, name: 'Manuel 54', credit: 5, vize: '54', final: '54', semester: 'Genel' }, // Yeni 54 -> DC -> KALDI (YANO < 2.50)
        { id: 4, name: 'Manuel 60', credit: 5, vize: '60', final: '60', semester: 'Genel' }  // Yeni 60 -> CC -> GECTI
    ];
    const autoStats = computeAllStats(autoCourses, DEFAULT_SETTINGS_2026, 'auto');

    const fizHtml = calculateStatus(autoCourses[0], autoStats, DEFAULT_SETTINGS_2026, 'auto');
    assert(fizHtml.includes('CC'), 'Legacy 54 must be CC');
    assert(fizHtml.includes('GEÇTİ'), 'Legacy 54 (CC) must be GECTI even with 2026 defaults (60/45)');

    const progHtml = calculateStatus(autoCourses[1], autoStats, DEFAULT_SETTINGS_2026, 'auto');
    assert(progHtml.includes('DC'), 'Legacy 45 must be DC');
    assert(progHtml.includes('ŞARTLI'), 'Legacy 45 (DC) must be SARTLI');

    const m54Html = calculateStatus(autoCourses[2], autoStats, DEFAULT_SETTINGS_2026, 'auto');
    assert(m54Html.includes('DC'), 'Genel 54 must be DC under 2026 system');

    const m60Html = calculateStatus(autoCourses[3], autoStats, DEFAULT_SETTINGS_2026, 'auto');
    assert(m60Html.includes('CC'), 'Genel 60 must be CC under 2026 system');
    assert(m60Html.includes('GEÇTİ'), 'Genel 60 must be GECTI under 2026 system');
}

// 10. Gizlilik Modu Testleri (Ayarlanabilir Esik + Hesaplama Butunlugu)
{
    const sem = '2026-2027 Güz Dönemi';
    const courses = [
        { id: 1, name: 'Dusuk Ders', credit: 5, vize: '30', final: '40', semester: sem },   // Ort 36 -> FF
        { id: 2, name: 'Orta Ders', credit: 5, vize: '65', final: '65', semester: sem },    // Ort 65 -> CC
        { id: 3, name: 'Yuksek Ders', credit: 5, vize: '75', final: '75', semester: sem },  // Ort 75 -> BB
        { id: 4, name: 'Tahmin Dusuk', credit: 4, vize: '30', final: '', semester: sem }    // Yalnizca Vize < 50
    ];

    const normalStats = computeAllStats(courses, DEFAULT_SETTINGS_2026, 'auto');
    const privSettings50 = { ...DEFAULT_SETTINGS_2026, privacyMode: true, privacyThreshold: 50 };
    const privStats50 = computeAllStats(courses, privSettings50, 'auto');

    // Hesaplamalar gizlilik modundan hic etkilenmemeli
    assert.strictEqual(privStats50.bySemester[sem].yano, normalStats.bySemester[sem].yano);
    assert.strictEqual(privStats50.overall.gano, normalStats.overall.gano);
    assert.strictEqual(privStats50.overall.avg100, normalStats.overall.avg100);

    // 36 ortalamali ders gizlenmeli (50 esigi ile)
    const lowHtml = calculateStatus(courses[0], privStats50, privSettings50, 'auto');
    assert(lowHtml.includes('Gizli'), 'Low grade must show Gizli badge');
    assert(lowHtml.includes('••'), 'Low grade must mask score');
    assert(!lowHtml.includes('36.00'), 'Low grade raw score must not leak');
    assert(!lowHtml.includes('FF'), 'Low grade letter FF must not leak');

    // 65 ortalamali ders 50 esiginde gorunur kalmali
    const midHtml50 = calculateStatus(courses[1], privStats50, privSettings50, 'auto');
    assert(midHtml50.includes('65.00') && midHtml50.includes('CC'));

    // Esik 70'e cekildiginde 65 ortalamali ders de gizlenmeli, 75 gorunmeli
    const privSettings70 = { ...DEFAULT_SETTINGS_2026, privacyMode: true, privacyThreshold: 70 };
    const midHtml70 = calculateStatus(courses[1], privStats50, privSettings70, 'auto');
    const highHtml70 = calculateStatus(courses[2], privStats50, privSettings70, 'auto');
    assert(midHtml70.includes('Gizli') && !midHtml70.includes('65.00'));
    assert(highHtml70.includes('75.00') && highHtml70.includes('BB'));

    // Tahmin modunda Vize < 50 ise hedefler privacy-peek details icinde gizlenmeli
    const predPrivHtml = calculateStatus(courses[3], privStats50, privSettings50, 'auto');
    assert(predPrivHtml.includes('privacy-peek'), 'Low midterm prediction must use privacy-peek details');
    assert(predPrivHtml.includes('Gizli'), 'Low midterm prediction must display Gizli badge');

    // isGradeHidden sinirlari
    assert.strictEqual(isGradeHidden(49.9, privSettings50), true);
    assert.strictEqual(isGradeHidden(50, privSettings50), false);
    assert.strictEqual(isGradeHidden(30, DEFAULT_SETTINGS_2026), false);
}

// 11. Benzersiz ID & sanitizeCourseIds Stres Testi (0 Cakisma)
{
    let bigObs = '2026-2027 Güz Dönemi\n';
    for (let i = 0; i < 50; i++) {
        bigObs += `${1202100 + i} 2027 Ders ${i} 3 Vize 70 Final 80 76 BB Başarılı\n`;
    }
    for (let t = 0; t < 20; t++) {
        const parsed = parseOBSText(bigObs);
        assert.strictEqual(new Set(parsed.courses.map(c => c.id)).size, 50, 'Course IDs must be strictly unique');
    }

    const dirty = sanitizeCourseIds([
        { id: '1;alert(1)', name: 'A' },
        { id: 5, name: 'B' },
        { id: 5, name: 'C' },
        { id: -3, name: 'D' }
    ]);
    assert.strictEqual(new Set(dirty.map(c => c.id)).size, 4);
    assert(dirty.every(c => Number.isInteger(c.id) && c.id > 0));
}

// 12. YANO 2.495 Yuvarlama Tutarlilik Testi (Asla "YANO 2.50 < 2.50" uretmemeli)
{
    const sem = '2026-2027 Güz Dönemi';
    const edgeYanoCourses = [
        { id: 1, name: 'A', credit: 50, vize: '95', final: '95', semester: sem },
        { id: 2, name: 'B', credit: 50, vize: '48', final: '48', semester: sem },
        { id: 3, name: 'C', credit: 1, vize: '62', final: '62', semester: sem }
    ]; // yano = 252/101 = 2.4950495 -> round2 = 2.50
    const st = computeAllStats(edgeYanoCourses, DEFAULT_SETTINGS_2026, 'auto');
    assert.strictEqual(round2(st.bySemester[sem].yano), 2.50);
    assert.strictEqual(st.bySemester[sem].dcDdPassed, true);
    const h = calculateStatus(edgeYanoCourses[1], st, DEFAULT_SETTINGS_2026, 'auto');
    assert(!h.includes('YANO 2.50 < 2.50'), 'Must not render contradictory YANO 2.50 < 2.50');
    assert(h.includes('GEÇTİ'), 'Rounded 2.50 must pass DC/DD consistently');
}

// 13. Ondalikli OBS Not Ayristirma Testi
{
    const decObs = '2026-2027 Güz Dönemi\n1202302 2027 Lab 2 Vize 65,5 Final 70,5';
    const p = parseOBSText(decObs);
    assert.strictEqual(p.courses.length, 1);
    assert.strictEqual(p.courses[0].vize, '65,5');
    assert.strictEqual(p.courses[0].final, '70,5');
}

console.log('ALL TESTS PASSED SUCCESSFULLY');
