/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
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
        const { fileId, newName } = await context.request.json() as any;
        const accessToken = await getAccessToken(context.env);

        // 1. Get the current parents of the file so we can remove them
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!fileRes.ok) {
            throw new Error(`ファイル情報の取得に失敗しました: ${await fileRes.text()}`);
        }
        const fileData = await fileRes.json() as { parents?: string[] };
        const currentParents = fileData.parents ? fileData.parents.join(',') : '';

        // 2. Move the file from the current folder to the DEST folder
        // For Shared Drives, moving files within the same shared drive is allowed using PATCH.
        const patchUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
        patchUrl.searchParams.set('addParents', DEST_FOLDER_ID);
        if (currentParents) {
            patchUrl.searchParams.set('removeParents', currentParents);
        }
        patchUrl.searchParams.set('supportsAllDrives', 'true');

        const moveBody = newName ? { name: newName } : undefined;

        const moveRes = await fetch(patchUrl.toString(), {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: moveBody ? JSON.stringify(moveBody) : undefined
        });

        if (!moveRes.ok) {
            const errText = await moveRes.text();
            throw new Error(`ファイルを「完了済」フォルダへ移動できませんでした: ${errText}`);
        }

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
};
