/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
}

async function getAccessToken(env: Env): Promise<string> {
    const clientEmail = env.GOOGLE_CLIENT_EMAIL || (env as any).VITE_GOOGLE_CLIENT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY || (env as any).VITE_GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        throw new Error("Google credentials are not configured.");
    }

    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp,
        iat
    };

    const token = await jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`
    });

    if (!response.ok) {
        throw new Error(`Failed to get Google Access Token: ${await response.text()}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { fileId, fileName, mimeType } = await context.request.json() as any;
        const accessToken = await getAccessToken(context.env);

        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!dlRes.ok) throw new Error(await dlRes.text());

        const fileBuffer = await dlRes.arrayBuffer();

        let contentType = mimeType || 'application/octet-stream';
        let ext = fileName.split('.').pop()?.toLowerCase() || '';

        if (contentType === 'application/pdf' && ext !== 'pdf') ext = 'pdf';
        if ((contentType === 'image/jpeg' || contentType === 'image/jpg') && !['jpg', 'jpeg'].includes(ext)) ext = 'jpg';
        if (contentType === 'image/png' && ext !== 'png') ext = 'png';

        const r2Filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext ? '.' + ext : ''}`;

        await context.env.BUCKET.put(r2Filename, fileBuffer, {
            httpMetadata: { contentType },
        });

        const publicUrl = `/api/image/${r2Filename}`;

        return Response.json({ success: true, url: publicUrl, mimeType: contentType });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
