const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const FOLDER_PATH = './google_drive_images';
const OUTPUT_SQL = './migration_data.sql';

if (!GEMINI_API_KEY) {
    console.error("Please set VITE_GEMINI_API_KEY in environment");
    process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const files = fs.readdirSync(FOLDER_PATH).filter(f => f.endsWith('.pdf') || f.endsWith('.jpg') || f.endsWith('.png'));
    console.log(`Found ${files.length} files to migrate.`);

    // Prepare SQL file
    fs.writeFileSync(OUTPUT_SQL, '');

    let count = 0;

    for (const file of files) {
        console.log(`Processing [${++count}/${files.length}]: ${file}`);
        const filePath = path.join(FOLDER_PATH, file);
        const mimeType = file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        const base64Data = fs.readFileSync(filePath).toString('base64');

        const payload = {
            contents: [
                {
                    parts: [
                        { text: "Extract the details from this business card and return ONLY a valid JSON object matching: { \"name\": \"\", \"company\": \"\", \"role\": \"\", \"email\": \"\", \"phone\": \"\", \"address\": \"\" }. If a field is not found, leave it empty. DO NOT use markdown formatting like ```json." },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
            }
        };

        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                throw new Error(`API error: ${resp.statusText}`);
            }

            const data = await resp.json();
            const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (textOutput) {
                const cleanedText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                const info = JSON.parse(cleanedText);

                // Escape quotes
                const escape = (str) => (str || '').replace(/'/g, "''");

                const sql = `INSERT INTO customers (name, company, role, email, phone, address, segment, memo, image_url) VALUES ('${escape(info.name)}', '${escape(info.company)}', '${escape(info.role)}', '${escape(info.email)}', '${escape(info.phone)}', '${escape(info.address)}', 'マイグレーション', 'Google Driveから一括インポート', '${escape(file)}');\n`;

                fs.appendFileSync(OUTPUT_SQL, sql);
                console.log(` -> Success: ${info.name || info.company || 'Unknown'}`);
            }
        } catch (e) {
            console.error(` -> Failed for ${file}:`, e.message);
        }

        // sleep to respect rate limits
        await sleep(2000);
    }

    console.log('Migration SQL generated! Run: npx wrangler d1 execute namecade-db --local --file=migration_data.sql');
}

main();
