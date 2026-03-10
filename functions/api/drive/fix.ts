/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
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
        const accessToken = await getAccessToken(context.env);

        // Fetch all files in the SOURCE_FOLDER_ID (where the mistakenly grabbed files are)
        const query = `'${SOURCE_FOLDER_ID}' in parents and trashed = false`;
        let sourceFiles: { id: string, name: string }[] = [];
        let pageToken = '';

        do {
            const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
            listUrl.searchParams.set('q', query);
            listUrl.searchParams.set('fields', 'nextPageToken, files(id, name)');
            listUrl.searchParams.set('supportsAllDrives', 'true');
            listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
            listUrl.searchParams.set('pageSize', '1000');
            if (pageToken) {
                listUrl.searchParams.set('pageToken', pageToken);
            }

            const listRes = await fetch(listUrl.toString(), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!listRes.ok) throw new Error(`Google Drive API error: ${await listRes.text()}`);

            const data = await listRes.json() as { files: { id: string, name: string }[], nextPageToken?: string };
            sourceFiles = sourceFiles.concat(data.files || []);
            pageToken = data.nextPageToken || '';
        } while (pageToken);

        let fixedCount = 0;

        for (const file of sourceFiles) {
            // Check if the filename maps to our standard format: Exchanger_Name_Company.pdf
            const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
            if (!nameWithoutExt) continue; // No extension?

            const parts = nameWithoutExt.replace('【重複】', '').split('_');
            if (parts.length >= 3) {
                const safeExchanger = parts[0];
                const safeName = parts[1];
                const safeCompany = parts.slice(2).join('_'); // In case company had underscores

                // Check DB for matching record
                // Remember we stripped special chars when saving the filename, so we use LIKE
                const stmt = context.env.DB.prepare(`
                    SELECT id FROM customers 
                    WHERE exchanger LIKE ? AND name LIKE ? AND company LIKE ?
                    LIMIT 1
                `).bind(`%${safeExchanger}%`, `%${safeName}%`, `%${safeCompany}%`);

                const match = await stmt.first<{ id: number }>();

                if (match) {
                    // 1. Update DB with the current actual drive_file_id
                    await context.env.DB.prepare(`
                        UPDATE customers SET drive_file_id = ? WHERE id = ?
                    `).bind(file.id, match.id).run();

                    // 2. Move file using PATCH back to DEST_FOLDER_ID
                    const patchUrl = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}`);
                    patchUrl.searchParams.set('addParents', DEST_FOLDER_ID);
                    patchUrl.searchParams.set('removeParents', SOURCE_FOLDER_ID);
                    patchUrl.searchParams.set('supportsAllDrives', 'true');

                    const moveRes = await fetch(patchUrl.toString(), {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });

                    if (moveRes.ok) {
                        fixedCount++;
                    }
                }
            }
        }

        return Response.json({ success: true, fixedCount });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
