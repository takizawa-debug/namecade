/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken } from '../_shared/google-drive';

export const onRequestGet: PagesFunction<DriveEnv> = async (context) => {
    const id = context.params.id;
    const { results } = await context.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).all();

    if (results.length === 0) {
        return new Response('Not found', { status: 404 });
    }
    return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<DriveEnv> = async (context) => {
    try {
        const id = context.params.id;
        const data = await context.request.json() as Record<string, unknown>;
        const {
            name, company, role, department,
            email, phone, phone_mobile, fax,
            address, postal_code, prefecture, city, address_line1, address_line2,
            website, sns_x, sns_facebook, sns_instagram, sns_linkedin, sns_other, name_romaji,
            exchanger, business_category, tags, memo, ai_analysis, added_at
        } = data;

        const stmt = context.env.DB.prepare(
            `UPDATE customers SET
                name=?, company=?, role=?, department=?,
                email=?, phone=?, phone_mobile=?, fax=?,
                address=?, postal_code=?, prefecture=?, city=?, address_line1=?, address_line2=?,
                website=?, sns_x=?, sns_facebook=?, sns_instagram=?, sns_linkedin=?, sns_other=?, name_romaji=?,
                exchanger=?, business_category=?, tags=?, memo=?, ai_analysis=?, added_at=COALESCE(?, added_at)
            WHERE id=?`
        ).bind(
            name || '', company || '', role || '', department || '',
            email || '', phone || '', phone_mobile || '', fax || '',
            address || '', postal_code || '', prefecture || '', city || '', address_line1 || '', address_line2 || '',
            website || '', sns_x || '', sns_facebook || '', sns_instagram || '', sns_linkedin || '', sns_other || '', name_romaji || '',
            exchanger || '', business_category || '', tags || '', memo || '', ai_analysis || '',
            added_at || null,
            id
        );

        await stmt.run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<DriveEnv> = async (context) => {
    try {
        const id = context.params.id;

        // 1. Get current drive_file_id
        const { results } = await context.env.DB.prepare('SELECT drive_file_id FROM customers WHERE id = ?').bind(id).all();
        if (results.length > 0 && results[0].drive_file_id as string) {
            const driveFileId = results[0].drive_file_id as string;

            // 2. Delete from Google Drive
            try {
                const accessToken = await getAccessToken(context.env);
                const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?supportsAllDrives=true`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (!dlRes.ok && dlRes.status !== 404) {
                    console.error("Failed to delete from Drive: ", await dlRes.text());
                }
            } catch (e) {
                console.error("Error calling Google Drive delete API: ", e);
            }
        }

        // 3. Delete from DB
        await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
