/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { ids: number[], data: any };
        const { business_category, tags, exchanger } = body.data;

        let updates = [];
        let params = [];
        if (business_category !== undefined) { updates.push('business_category = ?'); params.push(business_category); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
        if (exchanger !== undefined) { updates.push('exchanger = ?'); params.push(exchanger); }

        if (updates.length > 0 && body.ids && body.ids.length > 0) {
            const placeholders = body.ids.map(() => '?').join(',');
            params.push(...body.ids);

            await context.env.DB.prepare(
                `UPDATE customers SET ${updates.join(', ')} WHERE id IN (${placeholders})`
            ).bind(...params).run();
        }

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
