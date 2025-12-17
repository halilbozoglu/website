
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

    if (x > 4) x = 4;
    if (x < 0) x = 0;

    return parseFloat(x.toFixed(2));
}

console.log("68 -> " + getGradeFromScore(68));
console.log("64.72 -> " + getGradeFromScore(64.72));
console.log("Verification of 2.54 reverse: " + (2.54 * 18 + 19));
