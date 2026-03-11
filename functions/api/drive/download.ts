/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
    try {
        const { fileId, fileName, mimeType } = await context.request.json() as any;
        const accessToken = await getAccessToken(context.env);

        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!dlRes.ok) throw new Error(await dlRes.text());

        const fileBuffer = await dlRes.arrayBuffer();

        let contentType = mimeType || 'application/octet-stream';
        let ext = fileName.split('.').pop()?.toLowerCase() || '';

        if (contentType === 'application/pdf' && ext !== 'pdf') ext = 'pdf';
        if ((contentType === 'image/jpeg' || contentType === 'image/jpg') && !['jpg', 'jpeg'].includes(ext)) ext = 'jpg';
        if (contentType === 'image/png' && ext !== 'png') ext = 'png';

        const r2Filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${ext ? '.' + ext : ''}`;

        await context.env.BUCKET!.put(r2Filename, fileBuffer, {
            httpMetadata: { contentType },
        });

        const publicUrl = `/api/image/${r2Filename}`;

        return Response.json({ success: true, url: publicUrl, mimeType: contentType });
    } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
    }
};
