/// <reference types="@cloudflare/workers-types" />
import type { DriveEnv } from '../_shared/google-drive';

type Env = DriveEnv;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data = await context.request.json() as { fileId: string };
        const { fileId } = data;

        if (!fileId) {
            return Response.json({ success: false, error: 'Missing fileId' }, { status: 400 });
        }

        // Using SQLite INSERT ON CONFLICT DO UPDATE
        // If locked_at is older than 10 minutes (600 seconds), allow update.
        const stmt = context.env.DB.prepare(`
            INSERT INTO file_locks (file_id, locked_at) VALUES (?, datetime('now'))
            ON CONFLICT(file_id) DO UPDATE SET locked_at = datetime('now')
            WHERE cast(strftime('%s', 'now') as integer) - cast(strftime('%s', locked_at) as integer) > 600
            RETURNING file_id;
        `).bind(fileId);

        const result = await stmt.all();

        if (result.results && result.results.length > 0) {
            return Response.json({ success: true, claimed: true });
        } else {
            return Response.json({ success: false, error: 'File is already locked by another process', claimed: false });
        }

    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const fileId = url.searchParams.get('fileId');

        if (!fileId) {
            return Response.json({ success: false, error: 'Missing fileId' }, { status: 400 });
        }

        if (fileId === 'all') {
            const stmt = context.env.DB.prepare('DELETE FROM file_locks');
            await stmt.run();
        } else {
            const stmt = context.env.DB.prepare('DELETE FROM file_locks WHERE file_id = ?').bind(fileId);
            await stmt.run();
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
