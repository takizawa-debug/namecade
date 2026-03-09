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
            website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, gathered_links,
            exchanger, business_category, tags, memo, imageUrl, aiAnalysis
        } = data;

        const stmt = context.env.DB.prepare(
            `INSERT INTO customers (
                name, company, role, department, 
                email, phone, phone_mobile, fax, 
                address, postal_code, prefecture, city, address_line1, address_line2, 
                website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, gathered_links,
                exchanger, business_category, tags, memo, image_url, ai_analysis
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            gathered_links || '',
            exchanger || '',
            business_category || '',
            tags || '',
            memo || '',
            imageUrl || '',
            aiAnalysis || ''
        );

        const result = await stmt.run();
        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
