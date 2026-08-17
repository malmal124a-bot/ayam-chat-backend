const express = require('express');
const router = express.Router();

/**
 * Agency Operations API
 * All routes require JWT authentication.
 * Operations go through Supabase RPC functions (atomic, server-side).
 */
module.exports = function createAgencyRoutes(supabase, authMiddleware) {

  // ─── ALL ROUTES REQUIRE AUTH ───
  router.use(authMiddleware);

  // ─── GET /api/agency/wallet?agency_id=XXXX ───
  // Get agency wallet balance
  router.get('/wallet', async (req, res) => {
    try {
      const { agency_id } = req.query;
      if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

      const { data, error } = await supabase
        .from('agency_wallets')
        .select('*')
        .eq('agency_id', agency_id)
        .maybeSingle();

      if (error) throw error;

      // Auto-create wallet if doesn't exist
      if (!data) {
        const { data: newWallet, error: insertErr } = await supabase
          .from('agency_wallets')
          .insert({ agency_id, diamonds_balance: 0 })
          .select()
          .single();
        if (insertErr) throw insertErr;
        return res.json(newWallet);
      }

      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/topup ───
  // Top up agency wallet (admin only or self-charge)
  router.post('/topup', async (req, res) => {
    try {
      const { agency_id, diamonds, note } = req.body;
      if (!agency_id || !diamonds || diamonds <= 0) {
        return res.status(400).json({ error: 'agency_id and diamonds > 0 required' });
      }

      // Upsert wallet
      const { data: existing } = await supabase
        .from('agency_wallets')
        .select('*')
        .eq('agency_id', agency_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('agency_wallets')
          .update({
            diamonds_balance: existing.diamonds_balance + diamonds,
            updated_at: new Date().toISOString(),
          })
          .eq('agency_id', agency_id)
          .select()
          .single();
        if (error) throw error;
        return res.json(data);
      } else {
        const { data, error } = await supabase
          .from('agency_wallets')
          .insert({ agency_id, diamonds_balance: diamonds })
          .select()
          .single();
        if (error) throw error;
        return res.json(data);
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/recharge ───
  // Agent charges a user with diamonds (atomic RPC)
  router.post('/recharge', async (req, res) => {
    try {
      const { agency_id, target_user_id, target_numeric_id, diamonds, cost_diamonds } = req.body;
      const agent_uid = req.user.sub;

      if (!agency_id || !target_user_id || !diamonds || diamonds <= 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!cost_diamonds || cost_diamonds <= 0) {
        return res.status(400).json({ error: 'cost_diamonds required' });
      }

      const { data, error } = await supabase.rpc('rpc_agency_recharge', {
        p_agency_id: agency_id,
        p_agent_uid: agent_uid,
        p_target_uid: target_user_id,
        p_target_numeric_id: target_numeric_id || null,
        p_diamonds: diamonds,
        p_cost_diamonds: cost_diamonds,
      });

      if (error) throw error;
      if (!data.ok) return res.status(400).json(data);
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/withdraw ───
  // Withdraw diamonds from user to agency wallet (atomic RPC)
  router.post('/withdraw', async (req, res) => {
    try {
      const { agency_id, source_user_id, source_numeric_id, diamonds } = req.body;
      const agent_uid = req.user.sub;

      if (!agency_id || !source_user_id || !diamonds || diamonds <= 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data, error } = await supabase.rpc('rpc_agency_withdraw', {
        p_agency_id: agency_id,
        p_agent_uid: agent_uid,
        p_source_uid: source_user_id,
        p_source_numeric_id: source_numeric_id || null,
        p_diamonds: diamonds,
      });

      if (error) throw error;
      if (!data.ok) return res.status(400).json(data);
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/salary/calculate ───
  // Calculate salaries for agency members
  router.post('/salary/calculate', async (req, res) => {
    try {
      const { agency_id, user_ids, period_start, period_end } = req.body;
      const agent_uid = req.user.sub;

      if (!agency_id || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'agency_id and user_ids[] required' });
      }

      const { data, error } = await supabase.rpc('rpc_agency_calculate_salary', {
        p_agency_id: agency_id,
        p_agent_uid: agent_uid,
        p_user_ids: user_ids,
        p_period_start: period_start || new Date(Date.now() - 30 * 86400000).toISOString(),
        p_period_end: period_end || new Date().toISOString(),
      });

      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/salary/pay ───
  // Pay a single salary item
  router.post('/salary/pay', async (req, res) => {
    try {
      const { item_id, agency_id } = req.body;

      if (!item_id || !agency_id) {
        return res.status(400).json({ error: 'item_id and agency_id required' });
      }

      const { data, error } = await supabase.rpc('rpc_agency_pay_salary_item', {
        p_item_id: item_id,
        p_agency_id: agency_id,
      });

      if (error) throw error;
      if (!data.ok) return res.status(400).json(data);
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/salary/pay-all ───
  // Pay all pending salary items in a run
  router.post('/salary/pay-all', async (req, res) => {
    try {
      const { run_id, agency_id } = req.body;

      if (!run_id || !agency_id) {
        return res.status(400).json({ error: 'run_id and agency_id required' });
      }

      // Fetch all pending items
      const { data: items, error: fetchErr } = await supabase
        .from('agency_salary_items')
        .select('*')
        .eq('run_id', run_id)
        .eq('status', 'pending');

      if (fetchErr) throw fetchErr;

      const results = [];
      let paid = 0, failed = 0;

      for (const item of items || []) {
        const { data, error } = await supabase.rpc('rpc_agency_pay_salary_item', {
          p_item_id: item.id,
          p_agency_id: agency_id,
        });
        if (data?.ok) paid++;
        else failed++;
        results.push({ user_id: item.user_id, ok: data?.ok, error: data?.error });
      }

      // Update run status
      if (failed === 0 && items?.length > 0) {
        await supabase
          .from('agency_salary_runs')
          .update({ status: 'paid' })
          .eq('id', run_id);
      }

      res.json({ ok: true, paid, failed, results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/logs/recharges?agency_id=XXXX&limit=50 ───
  router.get('/logs/recharges', async (req, res) => {
    try {
      const { agency_id, limit = 50 } = req.query;
      if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

      const { data, error } = await supabase
        .from('agency_recharges')
        .select('*')
        .eq('agency_id', agency_id)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/logs/withdrawals?agency_id=XXXX&limit=50 ───
  router.get('/logs/withdrawals', async (req, res) => {
    try {
      const { agency_id, limit = 50 } = req.query;
      if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

      const { data, error } = await supabase
        .from('agency_withdrawals')
        .select('*')
        .eq('agency_id', agency_id)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/salary/runs?agency_id=XXXX ───
  router.get('/salary/runs', async (req, res) => {
    try {
      const { agency_id } = req.query;
      if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

      const { data, error } = await supabase
        .from('agency_salary_runs')
        .select('*')
        .eq('agency_id', agency_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/salary/items?run_id=XXXX ───
  router.get('/salary/items', async (req, res) => {
    try {
      const { run_id } = req.query;
      if (!run_id) return res.status(400).json({ error: 'run_id required' });

      const { data, error } = await supabase
        .from('agency_salary_items')
        .select('*')
        .eq('run_id', run_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/user/:uid/balance ───
  // Get a user's diamonds balance (for agent to check before recharge)
  router.get('/user/:uid/balance', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('auth_uid, numeric_id, name, diamonds, coins, photo_url')
        .or(`auth_uid.eq.${req.params.uid},numeric_id.eq.${req.params.uid}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'User not found' });
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/members?agency_id=XXXX ───
  router.get('/members', async (req, res) => {
    try {
      const { agency_id } = req.query;
      if (!agency_id) return res.status(400).json({ error: 'agency_id required' });

      const { data, error } = await supabase
        .from('host_agency_members')
        .select('*, users:users!host_agency_members_user_id_fkey(auth_uid, numeric_id, name, photo_url, diamonds)')
        .eq('agency_id', agency_id);

      if (error) {
        // Fallback: just get members without the join
        const { data: members, error: e2 } = await supabase
          .from('host_agency_members')
          .select('*')
          .eq('agency_id', agency_id);
        if (e2) throw e2;
        return res.json(members);
      }
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /api/agency/open-for-user ───
  // Open an agency for a user by their numeric_id + create auth account + send notification
  router.post('/open-for-user', async (req, res) => {
    try {
      const { target_numeric_id, agency_name, agency_type } = req.body;
      const agent_uid = req.user.sub;

      if (!target_numeric_id) {
        return res.status(400).json({ error: 'target_numeric_id required' });
      }

      // 1. Call RPC to create agency + wallet + notification
      const { data, error } = await supabase.rpc('rpc_open_agency_for_user', {
        p_target_numeric_id: target_numeric_id,
        p_agency_name: agency_name || '',
        p_agency_type: agency_type || 'shipping',
        p_agent_uid: agent_uid,
      });

      if (error) throw error;
      if (!data.ok) return res.status(400).json(data);

      // 2. Create Supabase auth account for the agency owner
      const email = `${target_numeric_id}@ayam.chat`;
      const password = `ayam${target_numeric_id}`;
      let authCreated = false;
      let authError = null;

      try {
        const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            numeric_id: target_numeric_id,
            agency_id: data.agency_id,
            name: data.user_name || '',
          },
        });

        if (createErr) {
          // If user already exists, that's OK
          if (createErr.message?.includes('already') || createErr.message?.includes('exists')) {
            authCreated = true;
          } else {
            authError = createErr.message;
          }
        } else {
          authCreated = true;
        }
      } catch (e) {
        authError = e.message;
      }

      res.json({
        ...data,
        auth_created: authCreated,
        auth_error: authError,
        dashboard_email: email,
        dashboard_password: password,
        dashboard_agency_id: data.agency_id,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GET /api/agency/my-agency?owner_uid=XXXX ───
  // Get agency by owner auth_uid OR numeric_id (for loading from Supabase)
  router.get('/my-agency', async (req, res) => {
    try {
      const { owner_uid } = req.query;
      if (!owner_uid) return res.status(400).json({ error: 'owner_uid required' });

      // Try direct match first (auth_uid)
      let { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('owner_id', owner_uid)
        .eq('is_activated', true)
        .maybeSingle();

      // If not found, try by numeric_id (look up auth_uid first)
      if (!data && !error) {
        const { data: user } = await supabase
          .from('users')
          .select('auth_uid')
          .eq('numeric_id', owner_uid)
          .maybeSingle();

        if (user) {
          const result = await supabase
            .from('agencies')
            .select('*')
            .eq('owner_id', user.auth_uid)
            .eq('is_activated', true)
            .maybeSingle();
          data = result.data;
          error = result.error;
        }
      }

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'No active agency found' });
      res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
