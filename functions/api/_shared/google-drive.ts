/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

export interface DriveEnv {
    DB: D1Database;
    BUCKET: R2Bucket;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
    GEMINI_API_KEY?: string;
}

export const SOURCE_FOLDER_ID = '1bB8Rjnn2wCQ7_qndglWNATiJTihRvEvz';
export const DEST_FOLDER_ID = '1E8QzBMmGgwRMEMvX34TRJ0xNy4WCOKm9';

export async function getAccessToken(env: DriveEnv): Promise<string> {
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

/**
 * Fetch all paginated results from Google Drive.
 */
export async function fetchAllDriveItems(q: string, fields: string, accessToken: string): Promise<any[]> {
    let items: any[] = [];
    let pageToken = '';
    do {
        const queryParams = new URLSearchParams({
            q,
            fields: `nextPageToken, ${fields}`,
            includeItemsFromAllDrives: 'true',
            supportsAllDrives: 'true',
            corpora: 'allDrives',
            pageSize: '1000'
        });
        if (pageToken) queryParams.set('pageToken', pageToken);

        const res = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as { files: any[], nextPageToken?: string };
        items = items.concat(data.files || []);
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return items;
}
