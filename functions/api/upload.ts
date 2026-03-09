/// <reference types="@cloudflare/workers-types" />

interface Env {
    BUCKET: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

        // Read the binary stream from the request
        const fileStream = await context.request.arrayBuffer();

        await context.env.BUCKET.put(filename, fileStream, {
            httpMetadata: { contentType: 'image/jpeg' },
        });

        const publicUrl = `/api/image/${filename}`;
        return Response.json({ success: true, url: publicUrl, filename });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
