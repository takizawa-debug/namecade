/// <reference types="@cloudflare/workers-types" />
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
}

// Ensure these are the correct folder IDs for your setup.
// From move.ts we know these IDs:
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

        // 1. Fetch all customer drive_file_ids from our database
        const { results } = await context.env.DB.prepare('SELECT id, drive_file_id FROM customers WHERE drive_file_id IS NOT NULL AND drive_file_id != ""').all();
        const dbCustomers = results as { id: number, drive_file_id: string }[];
        const dbFileIds = new Set(dbCustomers.map(c => c.drive_file_id));

        // 2. Fetch all valid files from Google Drive (both Source and Dest folders)
        // We use searching in either folder and NOT trashed.
        // Google Drive query syntax:
        // ('folderId1' in parents or 'folderId2' in parents) and trashed = false
        const query = `('${SOURCE_FOLDER_ID}' in parents or '${DEST_FOLDER_ID}' in parents) and trashed = false`;

        let allDriveFiles: Set<string> = new Set();
        let destFilesNotInDb: string[] = [];
        let pageToken = '';

        do {
            const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
            listUrl.searchParams.set('q', query);
            listUrl.searchParams.set('fields', 'nextPageToken, files(id, parents)');
            listUrl.searchParams.set('supportsAllDrives', 'true');
            listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
            listUrl.searchParams.set('pageSize', '1000');
            if (pageToken) {
                listUrl.searchParams.set('pageToken', pageToken);
            }

            const listRes = await fetch(listUrl.toString(), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!listRes.ok) {
                const text = await listRes.text();
                throw new Error(`Google Drive API error: ${text}`);
            }

            const data = await listRes.json() as { files: { id: string, parents?: string[] }[], nextPageToken?: string };
            data.files.forEach(f => {
                allDriveFiles.add(f.id);
                // If it's in the DEST folder but not registered in the DB, we need to move it back to SOURCE
                if (f.parents && f.parents.includes(DEST_FOLDER_ID) && !dbFileIds.has(f.id)) {
                    destFilesNotInDb.push(f.id);
                }
            });

            pageToken = data.nextPageToken || '';
        } while (pageToken);

        // 3. Compare and delete customers whose drive_file_id is missing from Google Drive
        let deletedIds: number[] = [];
        for (const customer of dbCustomers) {
            if (!allDriveFiles.has(customer.drive_file_id)) {
                // If the file is fully deleted or trashed in drive, we delete the customer row in our DB
                await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(customer.id).run();
                deletedIds.push(customer.id);
            }
        }

        // 4. Move files back to SOURCE if they are in DEST but not in DB
        let movedCount = 0;
        for (const fileId of destFilesNotInDb) {
            try {
                const patchUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
                patchUrl.searchParams.set('addParents', SOURCE_FOLDER_ID);
                patchUrl.searchParams.set('removeParents', DEST_FOLDER_ID);
                patchUrl.searchParams.set('supportsAllDrives', 'true');

                const moveRes = await fetch(patchUrl.toString(), {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (moveRes.ok) {
                    movedCount++;
                } else {
                    console.error("Failed to move orphaned file back to source", await moveRes.text());
                }
            } catch (e) {
                console.error("Error moving orphaned file", e);
            }
        }

        return Response.json({ success: true, deletedCount: deletedIds.length, movedCount, deletedIds });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
