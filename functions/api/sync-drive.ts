/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
}

const SOURCE_FOLDER_ID = '1bB8Rjnn2wCQ7_qndglWNATiJTihRvEvz';
const DEST_FOLDER_ID = '1E8QzBMmGgwRMEMvX34TRJ0xNy4WCOKm9';

async function getAccessToken(env: Env): Promise<string> {
    const clientEmail = env.GOOGLE_CLIENT_EMAIL || (env as any).VITE_GOOGLE_CLIENT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY || (env as any).VITE_GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        throw new Error("Google credentials are not configured.");
    }

    // Fix private key formatting if newlines are escaped
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
        const accessToken = await getAccessToken(context.env);

        // 1. List files in the source folder
        const listQuery = new URLSearchParams({
            q: `'${SOURCE_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
            pageSize: '50',
            includeItemsFromAllDrives: 'true',
            supportsAllDrives: 'true'
        });

        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?${listQuery.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!listRes.ok) throw new Error(`Drive list API error: ${await listRes.text()}`);

        const listData = await listRes.json() as { files: { id: string, name: string, mimeType: string }[] };
        const files = listData.files || [];

        const processedFiles = [];

        // 2. Process each file
        for (const file of files) {
            // Download file content
            const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!dlRes.ok) continue;

            const fileBuffer = await dlRes.arrayBuffer();

            // Prepare R2 metadata
            let contentType = file.mimeType || 'application/octet-stream';
            let ext = file.name.split('.').pop()?.toLowerCase() || '';

            // Handle pure pdf/images, default to keeping original name logic
            if (contentType === 'application/pdf' && ext !== 'pdf') ext = 'pdf';
            if ((contentType === 'image/jpeg' || contentType === 'image/jpg') && !['jpg', 'jpeg'].includes(ext)) ext = 'jpg';
            if (contentType === 'image/png' && ext !== 'png') ext = 'png';

            const r2Filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext ? '.' + ext : ''}`;

            // Save to R2
            await context.env.BUCKET.put(r2Filename, fileBuffer, {
                httpMetadata: { contentType },
            });

            const publicUrl = `/api/image/${r2Filename}`;

            // Save to D1
            await context.env.DB.prepare(
                'INSERT INTO scans (file_name, image_url, status) VALUES (?, ?, ?)'
            ).bind(r2Filename, publicUrl, 'pending').run();

            // 3. Move file to completed folder
            const moveQuery = new URLSearchParams({
                addParents: DEST_FOLDER_ID,
                removeParents: SOURCE_FOLDER_ID,
                supportsAllDrives: 'true'
            });

            await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?${moveQuery.toString()}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            processedFiles.push(file.name);
        }

        return Response.json({ success: true, processed: processedFiles.length, files: processedFiles });

    } catch (error) {
        console.error(error);
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
