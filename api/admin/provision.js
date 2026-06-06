import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAILS = ['jlundie@gmail.com', 'joel@supermomforhire.com'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const token = authHeader.replace('Bearer ', '');

  try {
    // 1. Verify caller is super admin
    const { data: { user: adminUser }, error: adminErr } = await supabaseAdmin.auth.getUser(token);
    if (adminErr || !adminUser || !SUPER_ADMIN_EMAILS.includes(adminUser.email)) {
      return res.status(403).json({ error: 'Forbidden: Only Super Admins can provision accounts.' });
    }

    const { businessName, ownerName, email, password } = req.body;
    if (!businessName || !ownerName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields (businessName, ownerName, email, password)' });
    }

    // 2. Create Auth User — reuse existing auth account if the email is already registered.
    // This handles the case where a business was soft-deleted (auth.users row persists)
    // and is being re-provisioned or linked to a new business.
    let newUser;
    const { data: { users: allAuthUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = allAuthUsers?.find(u => u.email === email);

    if (existingUser) {
      // Check if this auth user is already linked to a live (non-deleted) business
      const { data: existingLink } = await supabaseAdmin
        .from('users')
        .select('business_id, businesses(deleted_at)')
        .eq('id', existingUser.id)
        .maybeSingle();
      if (existingLink && existingLink.businesses && !existingLink.businesses.deleted_at) {
        return res.status(409).json({
          error: `An active account already exists for ${email}. If you meant to restore a deleted business, use the RESTORE button in the Admin panel instead.`
        });
      }
      // Reuse the existing auth user, update their password
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password, email_confirm: true });
      newUser = existingUser;
    } else {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { requires_password_change: true, full_name: ownerName }
      });
      if (authErr) throw new Error(`Auth creation failed: ${authErr.message}`);
      newUser = authData.user;
    }

    // 3. Create Business
    const { data: bizData, error: bizErr } = await supabaseAdmin.from('businesses').insert({
      name: businessName,
      owner_name: ownerName,
      email: email,
      hourly_rate: 60, 
      hst_rate: 0.13, 
      tax_enabled: false,
    }).select().single();
    if (bizErr) throw new Error(`Business creation failed: ${bizErr.message}`);

    // 4. Create/update User Link (public.users) — upsert so re-provisioned users don't hit a PK conflict
    const { error: linkErr } = await supabaseAdmin.from('users').upsert({
      id: newUser.id,
      business_id: bizData.id,
      first_name: ownerName.split(' ')[0],
      last_name: ownerName.split(' ').slice(1).join(' '),
      email: email,
      role: 'owner',
      status: 'active'
    }, { onConflict: 'id' });
    if (linkErr) throw new Error(`User linking failed: ${linkErr.message}`);

    // 5. Seed Default Services
    const SERVICES = [
      { name: 'Declutter',  pricing_type: 'Hourly', default_price: 160, default_duration: 180, sort_order: 1 },
      { name: 'Organize',   pricing_type: 'Hourly', default_price: 160, default_duration: 180, sort_order: 2 },
      { name: 'Assist',     pricing_type: 'Hourly', default_price: 120, default_duration: 120, sort_order: 3 },
      { name: 'Home Systems', pricing_type: 'Hourly', default_price: 160, default_duration: 180, sort_order: 4 },
      { name: 'Custom',     pricing_type: 'Hourly', default_price: 120, default_duration: 120, sort_order: 5 },
    ];
    const { error: svcErr } = await supabaseAdmin.from('services').insert(
      SERVICES.map(s => ({ ...s, business_id: bizData.id, active: true }))
    );
    if (svcErr) console.warn('Warning: Default services seeding failed:', svcErr.message);

    return res.status(200).json({ 
      success: true, 
      businessId: bizData.id, 
      userId: newUser.id 
    });
  } catch (error) {
    console.error('Provisioning Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
