/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken, SOURCE_FOLDER_ID, DEST_FOLDER_ID } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
    try {
        const accessToken = await getAccessToken(context.env);

        // 1. Fetch all customer drive_file_ids from our database
        const { results } = await context.env.DB.prepare('SELECT drive_file_id FROM customers WHERE drive_file_id IS NOT NULL AND drive_file_id != ""').all();
        const dbCustomers = results as { drive_file_id: string }[];
        const dbFileIds = new Set(dbCustomers.map(c => c.drive_file_id));

        // 2. Fetch all files in DEST folder
        const query = `'${DEST_FOLDER_ID}' in parents and trashed = false`;
        let destFilesNotInDb: string[] = [];
        let pageToken = '';

        do {
            const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
            listUrl.searchParams.set('q', query);
            listUrl.searchParams.set('fields', 'nextPageToken, files(id)');
            listUrl.searchParams.set('supportsAllDrives', 'true');
            listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
            listUrl.searchParams.set('pageSize', '1000');
            if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

            const listRes = await fetch(listUrl.toString(), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!listRes.ok) throw new Error(`Google Drive API error: ${await listRes.text()}`);

            const data = await listRes.json() as { files: { id: string }[], nextPageToken?: string };
            data.files.forEach(f => {
                if (!dbFileIds.has(f.id)) {
                    destFilesNotInDb.push(f.id);
                }
            });

            pageToken = data.nextPageToken || '';
        } while (pageToken);

        // 3. Move files back to SOURCE, removing 【重複】 tag from names
        let movedCount = 0;
        for (const fileId of destFilesNotInDb) {
            try {
                const patchUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
                patchUrl.searchParams.set('addParents', SOURCE_FOLDER_ID);
                patchUrl.searchParams.set('removeParents', DEST_FOLDER_ID);
                patchUrl.searchParams.set('supportsAllDrives', 'true');

                // Fetch file name to remove 【重複】 tag if present
                const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name&supportsAllDrives=true`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                let newName = undefined;
                if (fileRes.ok) {
                    const fileData = await fileRes.json() as { name: string };
                    if (fileData.name.includes('【重複】')) {
                        newName = fileData.name.replace('【重複】', '');
                    }
                }

                const moveBody = newName ? { name: newName } : undefined;

                const moveRes = await fetch(patchUrl.toString(), {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: moveBody ? JSON.stringify(moveBody) : undefined
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

        return Response.json({ success: true, movedCount });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
