interface Env {
    BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const filename = context.params.filename as string;
    const object = await context.env.BUCKET.get(filename);

    if (object === null) {
        return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    return new Response(object.body as unknown as BodyInit, {
        headers,
    });
};
