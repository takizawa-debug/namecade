/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken, SOURCE_FOLDER_ID, DEST_FOLDER_ID } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
    try {
        const accessToken = await getAccessToken(context.env);

        // Fetch all files in the SOURCE_FOLDER_ID
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

        // Fetch all customers into memory to avoid SQL LIKE complexity limits
        const { results } = await context.env.DB.prepare('SELECT id, name, company, exchanger FROM customers').all();
        const allCustomers = results as { id: number, name: string, company: string, exchanger: string }[];

        for (const file of sourceFiles) {
            const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
            if (!nameWithoutExt) continue;

            const parts = nameWithoutExt.replace('【重複】', '').split('_');
            if (parts.length >= 3) {
                const safeExchanger = parts[0];
                const safeName = parts[1];
                const safeCompany = parts.slice(2).join('_');

                const match = allCustomers.find(c => {
                    const cExchanger = (c.exchanger || '交換者不明').replace(/[\/\\?%*:|"<>]/g, '');
                    const cName = (c.name || '名前不明').replace(/[\/\\?%*:|"<>]/g, '');
                    const cCompany = (c.company || '会社不明').replace(/[\/\\?%*:|"<>]/g, '');
                    return cExchanger === safeExchanger && cName === safeName && cCompany === safeCompany;
                });

                if (match) {
                    await context.env.DB.prepare(`UPDATE customers SET drive_file_id = ? WHERE id = ?`).bind(file.id, match.id).run();

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
