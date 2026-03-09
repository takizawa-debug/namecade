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

        const promptText = `あなたはプロフェッショナルな名刺情報抽出・分析アシスタントです。提供された名刺画像（表裏両面が含まれている場合もあります）から、以下の情報を日本語を最優先して「極めて高い精度で」抽出し、指定されたJSON構造のみを出力してください。

【最重要ルール】
- 記載されていない情報は絶対に推測して埋めないでください。名刺に記載がない項目（SNSアカウントやURL等）は必ず「空文字("")」にしてください。存在しない情報を勝手に生成することは厳禁です。
- 会社名については、名刺上に「(株)」「㈱」といった略称が記載されている場合でも、必ず「株式会社」という正式名称に変換して出力してください。同様に「(有)」「㈲」は「有限会社」に、「(財)」「㈶」は「財団法人」にするなど、徹底して正式名称（完全な表記）で統一・正規化してください。
- 住所、部署、役職、電話番号などは細かく適切に分割してください。
- 抽出と同時に、取得した情報から相手がどのような組織に属しているか、どのようなビジネスの接点が持てそうか等について「AI分析コメント（100文字程度）」を作成し、\`aiAnalysis\`フィールドに格納してください。

構造:
{ 
  "name": "氏名", 
  "name_romaji": "氏名のローマ字読み（名刺に明記されている場合のみ。ない場合は空文字）",
  "company": "会社名", 
  "department": "部署（ない場合は空文字）", 
  "role": "役職（ない場合は空文字）", 
  "email": "メールアドレス", 
  "phone": "固定電話", 
  "phone_mobile": "携帯電話", 
  "fax": "FAX", 
  "postal_code": "郵便番号", 
  "prefecture": "都道府県", 
  "city": "市区町村", 
  "address_line1": "番地", 
  "address_line2": "建物名や階層（ない場合は空文字）", 
  "website": "WEBサイトURL（名刺に明記されている場合のみ）", 
  "sns_x": "X(Twitter)アカウント（名刺に明記されている場合のみ）",
  "sns_facebook": "Facebookアカウント（名刺に明記されている場合のみ）",
  "sns_instagram": "Instagramアカウント（名刺に明記されている場合のみ）",
  "sns_linkedin": "LinkedInアカウント（名刺に明記されている場合のみ）",
  "sns_other": "その他のSNS等のURL",
  "aiAnalysis": "AI分析コメント" 
}

条件（超重要🚨）:
- 日本語の氏名、会社名、住所などは「名刺に書かれている文字の通り」正確に読み取ってください。
- ローマ字での名前表記（フリガナ代わり）が名刺にある場合は、'name_romaji'として必ず抽出してください。
- 住所、部署、役職、電話番号などは細かく適切に分割してください。
- 企業名等のゆらぎについて：「(株)」や「㈱」といった略称が記載されている場合でも、**必ず「株式会社」という正式名称に変換して出力**してください。「(有)」は「有限会社」に統一してください。ここは絶対に守ってください。
- **名刺に直接書かれていない情報の推測・検索補完は一切行わないでください。**存在しないSNSアカウント、適当なURL、検索結果などで空欄を埋める行為は厳禁です。該当の記載がなければ必ず「空文字("")」にしてください。
- AI分析コメントは、名刺から得られた「客観的な事実（業種・部署・役職など）」のみから推測される、どのようなビジネスの接点になり得るかという簡潔なコメントを100文字程度で記述してください。
- JSONフォーマット以外（説明テキストや\`\`\`jsonなどのマークダウン）は一切出力しないでください。`;

        const payload = {
            contents: [
                {
                    parts: [
                        { text: promptText },
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

        let success = false;
        let retries = 0;

        while (!success && retries < 4) {
            try {
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (resp.status === 429) {
                    retries++;
                    console.log(` -> 429 Too Many Requests. Retrying in ${retries * 5} seconds...`);
                    await sleep(retries * 5000);
                    continue;
                }

                if (!resp.ok) {
                    throw new Error(`API error: ${resp.statusText}`);
                }

                const data = await resp.json();
                const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (textOutput) {
                    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
                    const cleanedText = jsonMatch ? jsonMatch[0] : textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                    const info = JSON.parse(cleanedText);

                    // Escape quotes
                    const escape = (str) => String(str || '').replace(/'/g, "''");

                    const combinedAddress = [info.prefecture, info.city, info.address_line1, info.address_line2].filter(Boolean).join('');

                    const sql = `INSERT INTO customers (
                        name, company, role, department, 
                        email, phone, phone_mobile, fax, 
                        address, postal_code, prefecture, city, address_line1, address_line2, 
                        website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, name_romaji,
                        tags, memo, image_url, ai_analysis
                    ) VALUES (
                        '${escape(info.name)}', '${escape(info.company)}', '${escape(info.role)}', '${escape(info.department)}', 
                        '${escape(info.email)}', '${escape(info.phone)}', '${escape(info.phone_mobile)}', '${escape(info.fax)}', 
                        '${escape(combinedAddress)}', '${escape(info.postal_code)}', '${escape(info.prefecture)}', '${escape(info.city)}', '${escape(info.address_line1)}', '${escape(info.address_line2)}', 
                        '${escape(info.website)}', '${escape(info.sns_x)}', '${escape(info.sns_facebook)}', '${escape(info.sns_instagram)}', '${escape(info.sns_linkedin)}', '${escape(info.sns_other)}', '${escape(info.name_romaji)}',
                        'マイグレーション', 'Google Driveから一括インポート', '${escape(file)}', '${escape(info.aiAnalysis || info.ai_analysis)}'
                    );\n`;

                    fs.appendFileSync(OUTPUT_SQL, sql);
                    console.log(` -> Success: ${info.name || info.company || 'Unknown'}`);
                    success = true;
                }
            } catch (e) {
                console.error(` -> Failed for ${file}:`, e.message);
                break;
            }
        }

        if (count >= 5) break;

        // sleep to respect rate limits
        await sleep(2000);
    }

    console.log('Migration SQL generated! Run: npx wrangler d1 execute namecade-db --local --file=migration_data.sql');
}

main();
