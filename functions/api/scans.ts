/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { results } = await context.env.DB.prepare('SELECT * FROM scans ORDER BY id DESC').all();
    return Response.json(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data = await context.request.json() as { file_name: string; image_url: string; status?: string };
        const { file_name, image_url, status = 'pending' } = data;

        const stmt = context.env.DB.prepare(
            `INSERT INTO scans (file_name, image_url, status) VALUES (?, ?, ?)`
        ).bind(file_name, image_url, status);

        const result = await stmt.run();
        return Response.json({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
