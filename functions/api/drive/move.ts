/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken, DEST_FOLDER_ID } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
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

        // 2. Move the file to the DEST folder
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
