/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { results } = await context.env.DB.prepare('SELECT * FROM customers ORDER BY id DESC').all();
    return Response.json(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data = await context.request.json() as Record<string, unknown>;
        const {
            name, company, role, department,
            email, phone, phone_mobile, fax,
            address, postal_code, prefecture, city, address_line1, address_line2,
            website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, name_romaji,
            exchanger, business_category, tags, memo, imageUrl, aiAnalysis, drive_file_id
        } = data;

        // Duplicate Check Heuristic (>= 3 matching elements among key fields)
        const checkStmt = context.env.DB.prepare(`
            SELECT id FROM customers WHERE (
                (CASE WHEN name = ? AND name != '' THEN 1 ELSE 0 END) +
                (CASE WHEN company = ? AND company != '' THEN 1 ELSE 0 END) +
                (CASE WHEN email = ? AND email != '' THEN 1 ELSE 0 END) +
                (CASE WHEN phone = ? AND phone != '' THEN 1 ELSE 0 END) +
                (CASE WHEN phone_mobile = ? AND phone_mobile != '' THEN 1 ELSE 0 END) +
                (CASE WHEN department = ? AND department != '' THEN 1 ELSE 0 END) +
                (CASE WHEN role = ? AND role != '' THEN 1 ELSE 0 END)
            ) >= 3 LIMIT 1
        `).bind(
            name || '', company || '', email || '', phone || '', phone_mobile || '', department || '', role || ''
        );

        const checkRes = await checkStmt.all();
        if (checkRes.results && checkRes.results.length > 0) {
            return Response.json({ success: true, duplicate: true, message: '重複データと判定されました' });
        }

        const stmt = context.env.DB.prepare(
            `INSERT INTO customers (
                name, company, role, department, 
                email, phone, phone_mobile, fax, 
                address, postal_code, prefecture, city, address_line1, address_line2, 
                website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, name_romaji,
                exchanger, business_category, tags, memo, image_url, ai_analysis, drive_file_id
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            name || '',
            company || '',
            role || '',
            department || '',
            email || '',
            phone || '',
            phone_mobile || '',
            fax || '',
            address || '',
            postal_code || '',
            prefecture || '',
            city || '',
            address_line1 || '',
            address_line2 || '',
            website || '',
            sns_x || '',
            sns_facebook || '',
            sns_instagram || '',
            sns_linkedin || '',
            sns_other || '',
            name_romaji || '',
            exchanger || '',
            business_category || '',
            tags || '',
            memo || '',
            imageUrl || '',
            aiAnalysis || '',
            drive_file_id || ''
        );

        const result = await stmt.run();
        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
