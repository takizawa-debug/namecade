/// <reference types="@cloudflare/workers-types" />
import type { DriveEnv } from '../_shared/google-drive';

type Env = DriveEnv;

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const id = context.params.id;
    const { results } = await context.env.DB.prepare('SELECT * FROM scans WHERE id = ?').bind(id).all();

    if (results.length === 0) {
        return new Response('Not found', { status: 404 });
    }
    return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id;
        const data = await context.request.json() as Record<string, unknown>;
        const { status, customer_id } = data;

        const stmt = context.env.DB.prepare(
            `UPDATE scans SET status=?, customer_id=? WHERE id=?`
        ).bind(
            status || 'pending',
            customer_id || null,
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
    // Potentially delete from R2 as well, but for now just DB
    await context.env.DB.prepare('DELETE FROM scans WHERE id = ?').bind(id).run();
    return Response.json({ success: true });
};
