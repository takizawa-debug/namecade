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

        // For Shared Drives, moving files or changing parents often faces the teamDrivesParentLimit constraint.
        // It is safer to make a copy in the new location and delete the old one.

        // 0. Get the driveId for DEST_FOLDER_ID
        const destFolderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${DEST_FOLDER_ID}?fields=driveId&supportsAllDrives=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        let destinationDriveId = undefined;
        if (destFolderRes.ok) {
            const destFolderData = await destFolderRes.json() as any;
            destinationDriveId = destFolderData.driveId;
        }

        // 1. Copy the file to the destination folder
        // The API requires knowing WHICH shared drive we are copying to, otherwise it throws 'insufficient permissions'.
        // We supply both the new parent AND the target shared drive ID.
        let copyUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true`;

        const copyBody: any = {
            parents: [DEST_FOLDER_ID],
            ...(destinationDriveId ? { driveId: destinationDriveId } : {})
        };

        if (newName) {
            copyBody.name = newName;
        }

        const copyRes = await fetch(copyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(copyBody)
        });

        if (!copyRes.ok) {
            const errText = await copyRes.text();
            throw new Error(`ファイルを「完了済」フォルダへコピーできませんでした: ${errText}`);
        }

        // 2. Trash the original file instead of hard delete
        // Content Managers in Shared Drives can only trash files, not permanently delete them (which DELETE does).
        const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trashed: true
            })
        });

        if (!trashRes.ok) {
            const errText = await trashRes.text();
            // If trashing fails with 404 or something, we shouldn't completely fail the move since copy succeeded.
            // But we will throw a readable error so the user knows.
            throw new Error(`コピーは成功しましたが、元の「未登録」ファイルのゴミ箱移動に失敗しました (手動で削除してください): ${errText}`);
        }

        return Response.json({ success: true });
    } catch (e) {
        return Response.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
};
