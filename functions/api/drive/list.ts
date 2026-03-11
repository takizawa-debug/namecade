/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken, fetchAllDriveItems, SOURCE_FOLDER_ID } from '../_shared/google-drive';

export const onRequestGet: PagesFunction<DriveEnv> = async (context) => {
    try {
        const accessToken = await getAccessToken(context.env);

        // 1. Get all subfolders
        const folders = await fetchAllDriveItems(
            `'${SOURCE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            'files(id, name)',
            accessToken
        );

        let allFiles: any[] = [];

        // 2. Fetch files from each subfolder
        for (const folder of folders) {
            const filesInFolder = await fetchAllDriveItems(
                `'${folder.id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
                'files(id, name, mimeType)',
                accessToken
            );

            allFiles = allFiles.concat(filesInFolder.map(f => ({
                ...f,
                folderName: folder.name
            })));
        }

        // 3. Also fetch files in the root folder
        const rootFiles = await fetchAllDriveItems(
            `'${SOURCE_FOLDER_ID}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
            'files(id, name, mimeType)',
            accessToken
        );

        allFiles = allFiles.concat(rootFiles.map(f => ({
            ...f,
            folderName: ''
        })));

        return Response.json({ success: true, files: allFiles });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
