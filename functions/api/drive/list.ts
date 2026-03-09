/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
}

const SOURCE_FOLDER_ID = '1bB8Rjnn2wCQ7_qndglWNATiJTihRvEvz';

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

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const accessToken = await getAccessToken(context.env);

        // 1. Get all subfolders
        const folderQuery = new URLSearchParams({
            q: `'${SOURCE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            includeItemsFromAllDrives: 'true',
            supportsAllDrives: 'true',
            corpora: 'allDrives'
        });

        const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?${folderQuery.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!folderRes.ok) throw new Error(await folderRes.text());
        const folderData = await folderRes.json() as { files: any[] };
        const folders = folderData.files || [];

        let allFiles: any[] = [];

        // 2. Fetch files from each subfolder
        for (const folder of folders) {
            const fileQuery = new URLSearchParams({
                q: `'${folder.id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name, mimeType)',
                includeItemsFromAllDrives: 'true',
                supportsAllDrives: 'true',
                corpora: 'allDrives'
            });

            const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?${fileQuery.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (fileRes.ok) {
                const fileData = await fileRes.json() as { files: any[] };
                const filesInFolder = (fileData.files || []).map(f => ({
                    ...f,
                    folderName: folder.name
                }));
                allFiles = allFiles.concat(filesInFolder);
            }
        }

        // 3. Also fetch files in the root folder just in case
        const rootFileQuery = new URLSearchParams({
            q: `'${SOURCE_FOLDER_ID}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name, mimeType)',
            includeItemsFromAllDrives: 'true',
            supportsAllDrives: 'true',
            corpora: 'allDrives'
        });

        const rootFileRes = await fetch(`https://www.googleapis.com/drive/v3/files?${rootFileQuery.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (rootFileRes.ok) {
            const rootFileData = await rootFileRes.json() as { files: any[] };
            const rootFiles = (rootFileData.files || []).map(f => ({
                ...f,
                folderName: ''
            }));
            allFiles = allFiles.concat(rootFiles);
        }

        return Response.json({ success: true, files: allFiles });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
