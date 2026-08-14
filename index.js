require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

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

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', supabase: supabase ? 'connected' : 'missing_config' });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Ayam Chat API',
    endpoints: ['/health', '/api/users', '/api/agencies', '/api/medals', '/api/rooms'],
  });
});

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

// Generic fallback guard
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`Ayam Chat API running on port ${PORT}`);
  log(`Supabase: ${supabase ? 'connected' : 'NOT CONFIGURED - set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'}`);
});
