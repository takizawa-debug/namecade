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

        const promptText = `あなたはプロフェッショナルな名刺情報抽出・分析アシスタントです。提供された名刺画像（表裏両面が含まれている場合もあります）から、以下の情報を日本語を最優先して極めて高い精度で抽出し、指定されたJSON構造のみを出力してください。

抽出と同時に、取得した総合的な情報から、相手がどのような組織・業種に属しているか、どのような役立つ接点（ビジネスチャンスなど）が持てそうか等について「AI分析コメント（150文字程度）」を作成し、\`aiAnalysis\`フィールドに格納してください。裏面の情報も加味してください。WEBサイトのURLやQRコード等があればそれも抽出してください。

また、会社名については、名刺上に「(株)」や「㈱」といった略称が記載されている場合でも、必ず「株式会社」という正式名称に変換して出力してください。同様に「(有)」「㈲」は「有限会社」に、「(財)」「㈶」は「財団法人」にするなど、正式名称（完全な表記）で統一してください。

構造:
{ 
  "name": "氏名", 
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
  "website": "WEBサイトURL", 
  "sns_x": "X(Twitter)アカウントURLまたはID",
  "sns_facebook": "FacebookアカウントURLまたはID",
  "sns_instagram": "InstagramアカウントURLまたはID",
  "sns_linkedin": "LinkedInアカウントURLまたはID",
  "sns_other": "その他のSNS等のURL",
  "gathered_links": "ウェブ検索で発見した公式HPやSNSなどの関連URLの箇条書き一覧（見つかった全てのURLを記録）",
  "aiAnalysis": "AI分析コメント" 
}

条件:
- 日本語の氏名、会社名、住所などは正確に読み取ってください。
- 住所、部署、役職、電話番号などは細かく適切に分割してください。
- 名刺に直接書かれていなくても、企業の公式HPや本人のSNS（X, Facebook, Instagram, LinkedIn等）がないかウェブ検索を通じて調査し、見つかった場合はそのURLやアカウント情報を各snsフィールドに入れてください。
- ウェブ検索等で発見したすべての公式HP、関連ニュース、SNSなどのリンクURLは、単なる分析用途だけでなくリストとして記録できるよう、'gathered_links' フィールドにハイフン(-)始まりの箇条書きで全件出力してください。
- AI分析コメントには、検索して得たその企業の事業内容や最近の動向、本人の発信内容なども加味して、より詳細で精度の高い「役立つ接点やビジネスチャンスの提案」を記述してください。
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
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
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
                    const cleanedText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                    const info = JSON.parse(cleanedText);

                    // Escape quotes
                    const escape = (str) => (str || '').replace(/'/g, "''");

                    const combinedAddress = [info.prefecture, info.city, info.address_line1, info.address_line2].filter(Boolean).join('');

                    const sql = `INSERT INTO customers (
                        name, company, role, department, 
                        email, phone, phone_mobile, fax, 
                        address, postal_code, prefecture, city, address_line1, address_line2, 
                        website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, gathered_links,
                        tags, memo, image_url, ai_analysis
                    ) VALUES (
                        '${escape(info.name)}', '${escape(info.company)}', '${escape(info.role)}', '${escape(info.department)}', 
                        '${escape(info.email)}', '${escape(info.phone)}', '${escape(info.phone_mobile)}', '${escape(info.fax)}', 
                        '${escape(combinedAddress)}', '${escape(info.postal_code)}', '${escape(info.prefecture)}', '${escape(info.city)}', '${escape(info.address_line1)}', '${escape(info.address_line2)}', 
                        '${escape(info.website)}', '${escape(info.sns_x)}', '${escape(info.sns_facebook)}', '${escape(info.sns_instagram)}', '${escape(info.sns_linkedin)}', '${escape(info.sns_other)}', '${escape(info.gathered_links)}',
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

        if (count >= 10) break;

        // sleep to respect rate limits
        await sleep(2000);
    }

    console.log('Migration SQL generated! Run: npx wrangler d1 execute namecade-db --local --file=migration_data.sql');
}

main();
