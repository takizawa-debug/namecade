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

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 1. Fetch all customers
        const { results: allCustomers } = await context.env.DB.prepare('SELECT * FROM customers ORDER BY id ASC').all();

        // 2. Group duplicates by [exchanger] + [company] + [name OR name_romaji]
        // Actually, we need a smarter grouping. Let's group by exchanger + company first, 
        // then within that group, find items that share name OR name_romaji.
        
        let mergedCount = 0;
        let deletedCount = 0;
        let driveFilesToDelete: string[] = [];
        let dbIdsToDelete: number[] = [];
        
        // Quick pass to normalize and group
        const normalize = (s: any) => (s || '').toString().trim().replace(/[\u3000\s]/g, '');
        
        const exchangerCompanyGroups: Record<string, any[]> = {};
        for (const customer of allCustomers) {
            const exch = normalize(customer.exchanger);
            const comp = normalize(customer.company);
            if (!exch || !comp) continue; // we only merge if we have valid exchanger and company
            
            const key = `${exch}::${comp}`;
            if (!exchangerCompanyGroups[key]) exchangerCompanyGroups[key] = [];
            exchangerCompanyGroups[key].push(customer);
        }

        const updateStatements = [];

        for (const key in exchangerCompanyGroups) {
            const group = exchangerCompanyGroups[key];
            if (group.length < 2) continue;

            // We need to group further by name or name_romaji overlap.
            // Since name overlap is transitive (if A matches B and B matches C), we can build connected components.
            const groupsByName: any[][] = [];
            
            for (const member of group) {
                const name = normalize(member.name);
                const romaji = normalize(member.name_romaji);
                
                let foundGroupIndex = -1;
                for (let i = 0; i < groupsByName.length; i++) {
                    const existingGroup = groupsByName[i];
                    const matches = existingGroup.some((existingMember: any) => {
                        const en = normalize(existingMember.name);
                        const er = normalize(existingMember.name_romaji);
                        return (name && en && name === en) || (romaji && er && romaji === er);
                    });
                    if (matches) {
                        foundGroupIndex = i;
                        break;
                    }
                }
                
                if (foundGroupIndex !== -1) {
                    groupsByName[foundGroupIndex].push(member);
                } else {
                    groupsByName.push([member]);
                }
            }
            
            // Now process each subgroup that has duplicates
            for (const subgroup of groupsByName) {
                if (subgroup.length < 2) continue;
                
                mergedCount++;
                
                // Primary is the oldest (first one in the array since we ordered by ASC)
                const primary = subgroup[0];
                const secondaries = subgroup.slice(1);
                
                const mergedData: any = { ...primary };
                
                for (const sec of secondaries) {
                    deletedCount++;
                    dbIdsToDelete.push(sec.id as number);
                    if (sec.drive_file_id) {
                        driveFilesToDelete.push(sec.drive_file_id as string);
                    }
                    
                    // Merge fields if primary is empty
                    for (const col of Object.keys(sec)) {
                        if (col === 'id' || col === 'drive_file_id') continue;
                        if (!mergedData[col] && sec[col]) {
                            mergedData[col] = sec[col];
                        }
                    }
                }
                
                // Update primary in DB
                updateStatements.push(
                    context.env.DB.prepare(
                        `UPDATE customers SET
                            name=?, company=?, role=?, department=?,
                            email=?, phone=?, phone_mobile=?, fax=?,
                            address=?, postal_code=?, prefecture=?, city=?, address_line1=?, address_line2=?,
                            website=?, sns_x=?, sns_facebook=?, sns_instagram=?, sns_linkedin=?, sns_other=?, name_romaji=?,
                            exchanger=?, business_category=?, tags=?, memo=?, ai_analysis=?
                        WHERE id=?`
                    ).bind(
                        mergedData.name || '',
                        mergedData.company || '',
                        mergedData.role || '',
                        mergedData.department || '',
                        mergedData.email || '',
                        mergedData.phone || '',
                        mergedData.phone_mobile || '',
                        mergedData.fax || '',
                        mergedData.address || '',
                        mergedData.postal_code || '',
                        mergedData.prefecture || '',
                        mergedData.city || '',
                        mergedData.address_line1 || '',
                        mergedData.address_line2 || '',
                        mergedData.website || '',
                        mergedData.sns_x || '',
                        mergedData.sns_facebook || '',
                        mergedData.sns_instagram || '',
                        mergedData.sns_linkedin || '',
                        mergedData.sns_other || '',
                        mergedData.name_romaji || '',
                        mergedData.exchanger || '',
                        mergedData.business_category || '',
                        mergedData.tags || '',
                        mergedData.memo || '',
                        mergedData.ai_analysis || '',
                        primary.id
                    )
                );
            }
        }

        // 3. Apply DB changes
        if (updateStatements.length > 0) {
            // D1 batch limit is typically 100 statements, we should chunk if large.
            const CHUNK_SIZE = 50;
            for (let i = 0; i < updateStatements.length; i += CHUNK_SIZE) {
                await context.env.DB.batch(updateStatements.slice(i, i + CHUNK_SIZE));
            }
        }
        
        if (dbIdsToDelete.length > 0) {
            const CHUNK_SIZE = 50;
            for (let i = 0; i < dbIdsToDelete.length; i += CHUNK_SIZE) {
                const chunk = dbIdsToDelete.slice(i, i + CHUNK_SIZE);
                const placeholders = chunk.map(() => '?').join(',');
                await context.env.DB.prepare(`DELETE FROM customers WHERE id IN (${placeholders})`).bind(...chunk).run();
            }
        }

        // 4. Delete drive files
        if (driveFilesToDelete.length > 0) {
            try {
                const accessToken = await getAccessToken(context.env);
                for (const fileId of driveFilesToDelete) {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    }).catch(console.error);
                }
            } catch (err) {
                console.error("Failed to acquire access token for Drive deletions", err);
            }
        }

        return Response.json({ success: true, mergedCount, deletedCount });
    } catch (e) {
        return Response.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
};
