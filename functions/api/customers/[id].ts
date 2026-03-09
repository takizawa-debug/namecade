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
        const data: any = await context.request.json();
        const { name, company, role, email, phone, address, segment, memo } = data;

        const stmt = context.env.DB.prepare(
            `UPDATE customers SET name=?, company=?, role=?, email=?, phone=?, address=?, segment=?, memo=? WHERE id=?`
        ).bind(
            name || '',
            company || '',
            role || '',
            email || '',
            phone || '',
            address || '',
            segment || '',
            memo || '',
            id
        );

        await stmt.run();
        return Response.json({ success: true });
    } catch (error: any) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
    return Response.json({ success: true });
};
