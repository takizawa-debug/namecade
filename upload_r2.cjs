const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = './google_drive_images';
const files = fs.readdirSync(dir);

let count = 0;
for (const file of files) {
    if (file.endsWith('.pdf') || file.endsWith('.jpg') || file.endsWith('.png')) {
        count++;
        if (count > 14) break; // only do the first 14
        console.log(`Uploading ${file}...`);
        try {
            execSync(`npx wrangler r2 object put namecade-bucket/"${file.replace(/"/g, '\\"')}" --file="${path.join(dir, file.replace(/"/g, '\\"'))}" --content-type=application/pdf --remote`, { stdio: 'inherit' });
        } catch (e) {
            console.error(e.message);
        }
    }
}
console.log('Done!');
