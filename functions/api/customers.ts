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
        const data: any = await context.request.json();
        const { name, company, role, email, phone, address, segment, memo, imageUrl } = data;

        const stmt = context.env.DB.prepare(
            `INSERT INTO customers (name, company, role, email, phone, address, segment, memo, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            name || '',
            company || '',
            role || '',
            email || '',
            phone || '',
            address || '',
            segment || '',
            memo || '',
            imageUrl || ''
        );

        const result = await stmt.run();
        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
};
