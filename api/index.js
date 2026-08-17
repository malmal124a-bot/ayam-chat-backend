const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../auth');
const createAgencyRoutes = require('../routes/agency');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', supabase: supabase ? 'connected' : 'missing_config' });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Ayam Chat API',
    version: '2.0',
    deployment: 'vercel',
    endpoints: [
      '/health', '/api/users', '/api/agencies', '/api/medals', '/api/rooms',
      '/api/store_items', '/api/banners', '/api/dm_messages', '/api/dashboard/stats',
      '/api/agency/* (auth required)',
    ],
  });
});

// ---------- AGENCY ROUTES (JWT auth required) ----------
if (supabase) {
  app.use('/api/agency', createAgencyRoutes(supabase, authMiddleware()));
}

// ---------- USERS ----------
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users').select('*')
      .or(`auth_uid.eq.${req.params.id},numeric_id.eq.${req.params.id}`)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users').update(req.body)
      .or(`auth_uid.eq.${req.params.id},numeric_id.eq.${req.params.id}`)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- AGENCIES ----------
app.get('/api/agencies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('agencies').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agencies/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agencies').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Agency not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agencies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('agencies').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/agencies/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agencies').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- MEDALS ----------
app.get('/api/medals', async (req, res) => {
  try {
    const { data, error } = await supabase.from('medals').select('*').order('order');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- ROOMS ----------
app.get('/api/rooms', async (req, res) => {
  try {
    const { data, error } = await supabase.from('rooms').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms').select('*').eq('room_id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Room not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/rooms/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms').update(req.body).eq('room_id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- STORE ITEMS ----------
app.get('/api/store_items', async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_items').select('*').order('order');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/store_items', async (req, res) => {
  try {
    const item = { ...req.body, updated_at: new Date().toISOString() };
    if (!item.id) { item.id = `item_${Date.now()}`; item.created_at = new Date().toISOString(); }
    const { data, error } = await supabase
      .from('store_items').upsert(item, { onConflict: 'id' }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/store_items/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('store_items').update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/store_items/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('store_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- BANNERS ----------
app.get('/api/banners', async (req, res) => {
  try {
    const { data, error } = await supabase.from('banners').select('*').order('order');
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/banners', async (req, res) => {
  try {
    const banner = req.body;
    if (!banner.id) banner.id = crypto.randomUUID();
    const { data, error } = await supabase
      .from('banners').upsert(banner, { onConflict: 'id' }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/banners/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('banners').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- DIRECT MESSAGES ----------
app.get('/api/dm_messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dm_messages').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- ADMIN OPERATIONS (service-role required) ----------
function adminAuth(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!SUPABASE_SERVICE_ROLE_KEY || token !== SUPABASE_SERVICE_ROLE_KEY) {
    res.status(403).json({ error: 'Forbidden: invalid admin key' });
    return false;
  }
  return true;
}

app.post('/api/admin/delete-agency', async (req, res) => {
  try {
    if (!adminAuth(req, res)) return;
    const { agency_id } = req.body;
    if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

    const { data: agency } = await supabase.from('agencies').select('owner_id, name').eq('id', agency_id).single();
    if (!agency) return res.status(404).json({ error: 'Agency not found' });

    await supabase.from('agency_wallets').delete().eq('agency_id', agency_id);
    await supabase.from('agency_topup_requests').delete().eq('agency_id', agency_id);
    await supabase.from('agency_topup_logs').delete().eq('agency_id', agency_id);
    await supabase.from('host_agency_members').delete().eq('agency_id', agency_id);
    await supabase.from('host_agency_join_requests').delete().eq('agency_id', agency_id);

    await supabase.from('agencies').delete().eq('id', agency_id);

    if (agency.owner_id) {
      try { await supabase.auth.admin.deleteUser(agency.owner_id); } catch {}
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/topup-approve', async (req, res) => {
  try {
    if (!adminAuth(req, res)) return;
    const { request_id } = req.body;
    if (!request_id) return res.status(400).json({ error: 'request_id required' });

    const { data: topupReq, error: rErr } = await supabase.from('agency_topup_requests').select('*').eq('id', request_id).single();
    if (rErr || !topupReq) return res.status(404).json({ error: 'Request not found' });
    if (topupReq.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    const { data: existing } = await supabase.from('agency_wallets').select('*').eq('agency_id', topupReq.agency_id).maybeSingle();
    if (!existing) {
      await supabase.from('agency_wallets').insert({ agency_id: topupReq.agency_id, diamonds_balance: topupReq.diamonds, total_recharged: topupReq.diamonds, total_withdrawn: 0 });
    } else {
      await supabase.from('agency_wallets').update({
        diamonds_balance: (existing.diamonds_balance ?? 0) + topupReq.diamonds,
        total_recharged: (existing.total_recharged ?? 0) + topupReq.diamonds,
      }).eq('agency_id', topupReq.agency_id);
    }

    await supabase.from('agency_topup_requests').update({ status: 'approved', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }).eq('id', request_id);
    await supabase.from('agency_topup_logs').insert({ request_id, agency_id: topupReq.agency_id, gateway_id: topupReq.gateway_id, amount_usd: topupReq.amount_usd, diamonds: topupReq.diamonds, approved_by: 'admin' });

    const { data: finalWallet } = await supabase.from('agency_wallets').select('diamonds_balance').eq('agency_id', topupReq.agency_id).single();
    res.json({ ok: true, diamonds_balance: finalWallet?.diamonds_balance ?? 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/topup-reject', async (req, res) => {
  try {
    if (!adminAuth(req, res)) return;
    const { request_id, note } = req.body;
    if (!request_id) return res.status(400).json({ error: 'request_id required' });

    await supabase.from('agency_topup_requests').update({ status: 'rejected', admin_note: note || '', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }).eq('id', request_id).eq('status', 'pending');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/topup-direct', async (req, res) => {
  try {
    if (!adminAuth(req, res)) return;
    const { agency_id, diamonds } = req.body;
    if (!agency_id || !diamonds || diamonds <= 0) return res.status(400).json({ error: 'agency_id and diamonds required' });

    const { data: existing } = await supabase.from('agency_wallets').select('*').eq('agency_id', agency_id).maybeSingle();
    if (!existing) {
      await supabase.from('agency_wallets').insert({ agency_id, diamonds_balance: diamonds, total_recharged: diamonds, total_withdrawn: 0 });
    } else {
      await supabase.from('agency_wallets').update({
        diamonds_balance: (existing.diamonds_balance ?? 0) + diamonds,
        total_recharged: (existing.total_recharged ?? 0) + diamonds,
      }).eq('agency_id', agency_id);
    }

    await supabase.from('agency_topup_logs').insert({ agency_id, amount_usd: 0, diamonds, approved_by: 'admin' });

    const { data: finalWallet } = await supabase.from('agency_wallets').select('diamonds_balance').eq('agency_id', agency_id).single();
    res.json({ ok: true, diamonds_balance: finalWallet?.diamonds_balance ?? 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/open-agency', async (req, res) => {
  try {
    if (!adminAuth(req, res)) return;
    const { numeric_id, agency_type, agency_name } = req.body;
    if (!numeric_id) return res.status(400).json({ error: 'numeric_id required' });

    // 1. Call RPC to create agency + wallet + DM
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_open_agency_for_user', {
      p_target_numeric_id: numeric_id,
      p_agency_type: agency_type || 'shipping',
      p_agency_name: agency_name || '',
    });
    if (rpcErr) throw rpcErr;
    if (!rpcResult?.ok) return res.status(400).json({ error: rpcResult?.error || 'فشل فتح الوكالة' });

    const email = `${numeric_id}@ayam.chat`;
    const password = `ayam${numeric_id}`;

    // 2. Create Supabase auth account
    try {
      const { error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { numeric_id, agency_id: rpcResult.agency_id },
      });
      if (authErr && !authErr.message?.includes('already')) {
        console.warn('Auth account creation warning:', authErr.message);
      }
    } catch (e) {
      console.warn('Auth account creation failed:', e);
    }

    res.json({ ok: true, agency_id: rpcResult.agency_id, dashboard_email: email, dashboard_password: password });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- DASHBOARD STATS ----------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [users, rooms, messages, dms, participants, gifts] = await Promise.all([
      supabase.from('users').select('auth_uid,is_online', { count: 'exact' }),
      supabase.from('rooms').select('room_id,is_active', { count: 'exact' }),
      supabase.from('messages').select('id', { count: 'exact' }),
      supabase.from('dm_messages').select('id', { count: 'exact' }),
      supabase.from('participants').select('id', { count: 'exact' }),
      supabase.from('messages').select('gift_count').eq('type', 'gift'),
    ]);
    let diamondsSpent = 0;
    for (const r of gifts.data || []) diamondsSpent += Number(r.gift_count || 0);
    res.json({
      users: users.count || 0,
      rooms: rooms.count || 0,
      messages: messages.count || 0,
      dms: dms.count || 0,
      participants: participants.count || 0,
      giftsSent: gifts.data ? gifts.data.length : 0,
      diamondsSpent,
      onlineUsers: (users.data || []).filter((u) => u.is_online).length,
      activeRooms: (rooms.data || []).filter((r) => r.is_active).length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generic fallback guard
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

module.exports = app;
