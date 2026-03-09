/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const id = context.params.id;
    const { results } = await context.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).all();

    if (results.length === 0) {
        return new Response('Not found', { status: 404 });
    }
    return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id;
        const data = await context.request.json() as Record<string, unknown>;
        const {
            name, company, role, department,
            email, phone, phone_mobile, fax,
            address, postal_code, prefecture, city, address_line1, address_line2,
            website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, name_romaji,
            exchanger, business_category, tags, memo, ai_analysis
        } = data;

        const stmt = context.env.DB.prepare(
            `UPDATE customers SET
                name=?, company=?, role=?, department=?,
                email=?, phone=?, phone_mobile=?, fax=?,
                address=?, postal_code=?, prefecture=?, city=?, address_line1=?, address_line2=?,
                website=?, sns_x=?, sns_facebook=?, sns_instagram=?, sns_linkedin=?, sns_other=?, name_romaji=?,
                exchanger=?, business_category=?, tags=?, memo=?, ai_analysis=?
            WHERE id=?`
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
            ai_analysis || '',
            id
        );

        await stmt.run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
    return Response.json({ success: true });
};
