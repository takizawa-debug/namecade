/// <reference types="@cloudflare/workers-types" />
import { DriveEnv, getAccessToken } from '../_shared/google-drive';

export const onRequestPost: PagesFunction<DriveEnv> = async (context) => {
    try {
        // 1. Fetch all customers
        const { results: allCustomers } = await context.env.DB.prepare('SELECT * FROM customers ORDER BY id ASC').all();

        // 2. Group duplicates by [exchanger] + [company] + [name OR name_romaji]
        let mergedCount = 0;
        let deletedCount = 0;
        const driveFilesToDelete: string[] = [];
        const dbIdsToDelete: number[] = [];

        const normalize = (s: any) => (s || '').toString().trim().replace(/[\u3000\s]/g, '');

        // Group by exchanger + company
        const groups: Record<string, any[]> = {};
        for (const customer of allCustomers) {
            const exch = normalize(customer.exchanger);
            const comp = normalize(customer.company);
            if (!exch || !comp) continue;

            const key = `${exch}::${comp}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(customer);
        }

        const updateStatements = [];

        for (const key in groups) {
            const group = groups[key];
            if (group.length < 2) continue;

            // Sub-group by name/name_romaji overlap
            const subgroups: any[][] = [];

            for (const member of group) {
                const name = normalize(member.name);
                const romaji = normalize(member.name_romaji);

                let foundIdx = -1;
                for (let i = 0; i < subgroups.length; i++) {
                    const matches = subgroups[i].some((m: any) => {
                        const en = normalize(m.name);
                        const er = normalize(m.name_romaji);
                        return (name && en && name === en) || (romaji && er && romaji === er);
                    });
                    if (matches) { foundIdx = i; break; }
                }

                if (foundIdx !== -1) {
                    subgroups[foundIdx].push(member);
                } else {
                    subgroups.push([member]);
                }
            }

            // Process each duplicate subgroup
            for (const subgroup of subgroups) {
                if (subgroup.length < 2) continue;

                mergedCount++;
                const primary = subgroup[0];
                const secondaries = subgroup.slice(1);
                const mergedData: any = { ...primary };

                for (const sec of secondaries) {
                    deletedCount++;
                    dbIdsToDelete.push(sec.id as number);
                    if (sec.drive_file_id) driveFilesToDelete.push(sec.drive_file_id as string);

                    // Fill empty fields from secondary
                    for (const col of Object.keys(sec)) {
                        if (col === 'id' || col === 'drive_file_id') continue;
                        if (!mergedData[col] && sec[col]) mergedData[col] = sec[col];
                    }
                }

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
                        mergedData.name || '', mergedData.company || '', mergedData.role || '', mergedData.department || '',
                        mergedData.email || '', mergedData.phone || '', mergedData.phone_mobile || '', mergedData.fax || '',
                        mergedData.address || '', mergedData.postal_code || '', mergedData.prefecture || '', mergedData.city || '', mergedData.address_line1 || '', mergedData.address_line2 || '',
                        mergedData.website || '', mergedData.sns_x || '', mergedData.sns_facebook || '', mergedData.sns_instagram || '', mergedData.sns_linkedin || '', mergedData.sns_other || '', mergedData.name_romaji || '',
                        mergedData.exchanger || '', mergedData.business_category || '', mergedData.tags || '', mergedData.memo || '', mergedData.ai_analysis || '',
                        primary.id
                    )
                );
            }
        }

        // 3. Apply DB changes in chunks
        const CHUNK_SIZE = 50;
        if (updateStatements.length > 0) {
            for (let i = 0; i < updateStatements.length; i += CHUNK_SIZE) {
                await context.env.DB.batch(updateStatements.slice(i, i + CHUNK_SIZE));
            }
        }

        if (dbIdsToDelete.length > 0) {
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
