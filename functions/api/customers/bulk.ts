/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { ids: number[], data: any };
        const { business_category, tags, exchanger, added_at } = body.data;

        let updates = [];
        let params = [];
        if (business_category !== undefined) { updates.push('business_category = ?'); params.push(business_category); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
        if (exchanger !== undefined) { updates.push('exchanger = ?'); params.push(exchanger); }
        if (added_at !== undefined) { updates.push('added_at = ?'); params.push(added_at); }

        if (updates.length > 0 && body.ids && body.ids.length > 0) {
            // Cloudflare D1 has a hard limit of 100 parameters per query.
            // We have `updates.length` parameters for the SET clause.
            // That leaves (100 - updates.length) for the IN clause max, but to be safe let's chunk by 50 IDs.
            const CHUNK_SIZE = 50;
            const statements = [];

            for (let i = 0; i < body.ids.length; i += CHUNK_SIZE) {
                const chunkIds = body.ids.slice(i, i + CHUNK_SIZE);
                const placeholders = chunkIds.map(() => '?').join(',');
                const chunkParams = [...params, ...chunkIds];

                statements.push(
                    context.env.DB.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id IN (${placeholders})`).bind(...chunkParams)
                );
            }

            // Execute all chunks in a batch transaction
            if (statements.length > 0) {
                await context.env.DB.batch(statements);
            }
        }

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
