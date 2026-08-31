// Vercel Serverless Function: Real-Time Multi-Volunteer Election Sync Endpoint
// Route: https://piplantri.vercel.app/api/sync

let globalDeltas = {};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'POST') {
            const body = req.body || {};
            const incomingDeltas = body.deltas || {};
            
            // Merge incoming deltas
            let mergedCount = 0;
            Object.keys(incomingDeltas).forEach(vid => {
                const incoming = incomingDeltas[vid];
                const existing = globalDeltas[vid];

                if (!existing || (incoming.updated_at && (!existing.updated_at || incoming.updated_at >= existing.updated_at))) {
                    globalDeltas[vid] = { ...(existing || {}), ...incoming };
                    mergedCount++;
                }
            });

            // Also persist to secondary cloud store for redundancy
            fetch('https://api.npoint.io/46c07a97637c35951d95', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deltas: globalDeltas,
                    last_updated: Date.now(),
                    last_volunteer: body.volunteer || 'Unknown'
                })
            }).catch(() => {});

            return res.status(200).json({
                success: true,
                message: 'Synced successfully',
                total_deltas: Object.keys(globalDeltas).length,
                merged_count: mergedCount,
                deltas: globalDeltas
            });
        } else {
            // GET request - return latest deltas
            // Fetch from secondary persistent store if in-memory is empty
            if (Object.keys(globalDeltas).length === 0) {
                try {
                    const fallback = await fetch('https://api.npoint.io/46c07a97637c35951d95').then(r => r.json());
                    if (fallback && fallback.deltas) {
                        globalDeltas = { ...fallback.deltas };
                    }
                } catch (e) {}
            }

            return res.status(200).json({
                success: true,
                total_deltas: Object.keys(globalDeltas).length,
                deltas: globalDeltas
            });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
