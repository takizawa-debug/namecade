/// <reference types="@cloudflare/workers-types" />

import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
    DB: D1Database;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;
}

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
        exp, iat
    };
    const token = await jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`
    });
    if (!response.ok) throw new Error(`Failed to get Google Access Token: ${await response.text()}`);
    const data = await response.json() as { access_token: string };
    return data.access_token;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const id = context.params.id;
    const { results } = await context.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).all();

    if (results.length === 0) {
        return new Response('Not found', { status: 404 });
    }
    return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
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
            name || '',
            company || '',
            role || '',
            department || '',
            email || '',
            phone || '',
            phone_mobile || '',
            fax || '',
            address || '',
            postal_code || '',
            prefecture || '',
            city || '',
            address_line1 || '',
            address_line2 || '',
            website || '',
            sns_x || '',
            sns_facebook || '',
            sns_instagram || '',
            sns_linkedin || '',
            sns_other || '',
            name_romaji || '',
            exchanger || '',
            business_category || '',
            tags || '',
            memo || '',
            ai_analysis || '',
            added_at || null,
            id
        );

        await stmt.run();
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
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
