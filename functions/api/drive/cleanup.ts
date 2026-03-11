/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken, SOURCE_FOLDER_ID, DEST_FOLDER_ID } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
    try {
        const accessToken = await getAccessToken(context.env);

        // 1. Fetch all customer drive_file_ids from our database
        const { results } = await context.env.DB.prepare('SELECT id, drive_file_id FROM customers WHERE drive_file_id IS NOT NULL AND drive_file_id != ""').all();
        const dbCustomers = results as { id: number, drive_file_id: string }[];
        const dbFileIds = new Set(dbCustomers.map(c => c.drive_file_id));

        // 2. Fetch all files from Google Drive (both Source and Dest folders)
        const query = `('${SOURCE_FOLDER_ID}' in parents or '${DEST_FOLDER_ID}' in parents) and trashed = false`;

        let allDriveFiles: Set<string> = new Set();
        let destFilesNotInDb: string[] = [];
        let pageToken = '';

        do {
            const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
            listUrl.searchParams.set('q', query);
            listUrl.searchParams.set('fields', 'nextPageToken, files(id, name, parents)');
            listUrl.searchParams.set('supportsAllDrives', 'true');
            listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
            listUrl.searchParams.set('pageSize', '1000');
            if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

            const listRes = await fetch(listUrl.toString(), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!listRes.ok) throw new Error(`Google Drive API error: ${await listRes.text()}`);

            const data = await listRes.json() as { files: { id: string, name: string, parents?: string[] }[], nextPageToken?: string };
            data.files.forEach(f => {
                allDriveFiles.add(f.id);
                if (f.parents && f.parents.includes(DEST_FOLDER_ID) && !dbFileIds.has(f.id)) {
                    if (!f.name.includes('【重複】')) {
                        destFilesNotInDb.push(f.id);
                    }
                }
            });

            pageToken = data.nextPageToken || '';
        } while (pageToken);

        // 3. Delete customers whose drive_file_id is missing from Google Drive
        let deletedIds: number[] = [];
        for (const customer of dbCustomers) {
            if (!allDriveFiles.has(customer.drive_file_id)) {
                await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(customer.id).run();
                deletedIds.push(customer.id);
            }
        }

        // 4. Move orphaned files back to SOURCE
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
