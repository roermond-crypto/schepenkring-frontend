const fs = require('fs');
const path = require('path');

const oldDir = '/Users/macbookpro/Documents/My-project/martjin project/old-project/frontend/messages';
const newDir = path.join(__dirname, 'src', 'locales');

const locales = ['en', 'nl', 'de'];
const keysToMerge = ['DashboardYachts', 'YachtWizard', 'fallback'];

locales.forEach(loc => {
    const oldPath = path.join(oldDir, `${loc}.json`);
    const newPath = path.join(newDir, `${loc}.json`);

    if (fs.existsSync(oldPath) && fs.existsSync(newPath)) {
        const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
        const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));

        let merged = false;
        for (const key of keysToMerge) {
            if (oldData[key]) {
                newData[key] = oldData[key];
                merged = true;
            }
        }

        if (merged) {
            fs.writeFileSync(newPath, JSON.stringify(newData, null, 2), 'utf8');
            console.log(`Merged keys into ${loc}.json`);
        }
    }
});
