const fs = require('fs');

(async () => {
    try {
        const file = 'google_drive_images/スキャン 2026_03_09 11:49:23.pdf';
        const base64Data = fs.readFileSync(file).toString('base64');
        const payload = {
            contents: [
                {
                    parts: [
                        { text: 'この画像の名刺に書かれている会社名と氏名を教えてください。また、その会社のウェブサイトを検索してURLを教えてください。JSON形式で出力してください。 { "company": "", "name": "", "url": "" }' },
                        {
                            inline_data: { mime_type: 'application/pdf', data: base64Data }
                        }
                    ]
                }
            ],
            tools: [{ googleSearch: {} }]
        };
        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + process.env.VITE_GEMINI_API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) { console.error(e); }
})();
