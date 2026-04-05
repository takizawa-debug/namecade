/// <reference types="@cloudflare/workers-types" />
import type { DriveEnv } from './_shared/google-drive';

type Env = DriveEnv;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const contentType = context.request.headers.get('Content-Type') || 'image/jpeg';
        const isPdf = contentType === 'application/pdf';
        const extension = isPdf ? '.pdf' : '.jpg';
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;

        // Read the binary stream from the request
        const fileStream = await context.request.arrayBuffer();

        await context.env.BUCKET.put(filename, fileStream, {
            httpMetadata: { contentType },
        });

        const publicUrl = `/api/image/${filename}`;
        return Response.json({ success: true, url: publicUrl, filename });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
