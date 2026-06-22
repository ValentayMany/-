const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

const USERNAME_PREFIX_MAP = {
  'เบเบฒเบเบขเบฒ': 'Pharmacy',
  'เบเบฐเบเบฒเบเบฒเบ': 'Nurse',
  'เบเบฒเบเปเบ': 'Internal medicine',
  'เป€เบ”เบฑเบเบเปเบญเบ': 'Pediatric Department',
  'เบงเบดเป€เบเบฒเบฐ': 'Laboratory Department',
  'เปเบเป€เบเบต': 'Chauffeur',
  'เบเบนเปเบ”เบนเปเบฅ': 'Admin',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  try {
    if (url.pathname === '/api/config' && request.method === 'GET') {
      return json({
        supabaseUrl: env.SUPABASE_URL || '',
        supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
        isSupabaseConfigured: isSupabaseConfigured(env),
      });
    }

    if (!isSupabaseConfigured(env)) {
      return json({ error: 'Supabase is not configured for this Cloudflare Worker.' }, 500);
    }

    if (url.pathname === '/api/staff' && request.method === 'GET') {
      const data = await supabase(env, 'staff', {
        query: { select: '*', order: 'name.asc' },
      });
      return json(sortByName(data));
    }

    if (url.pathname === '/api/staff' && request.method === 'POST') {
      const body = await request.json();
      const { name, department, rate_per_shift, notes } = body;
      if (!name || !department) {
        return json({ error: 'Name and department are required' }, 400);
      }

      const data = await supabase(env, 'staff', {
        method: 'POST',
        body: {
          name,
          department,
          rate_per_shift: Number(rate_per_shift) || 0,
          notes: notes || '',
        },
        preferRepresentation: true,
      });
      return json(data[0], 201);
    }

    const staffMatch = url.pathname.match(/^\/api\/staff\/([^/]+)$/);
    if (staffMatch && request.method === 'PUT') {
      const body = await request.json();
      const data = await supabase(env, 'staff', {
        method: 'PATCH',
        query: { id: `eq.${staffMatch[1]}` },
        body: {
          name: body.name,
          department: body.department,
          rate_per_shift: Number(body.rate_per_shift) || 0,
          notes: body.notes,
        },
        preferRepresentation: true,
      });
      if (data.length === 0) return json({ error: 'Staff member not found' }, 404);
      return json(data[0]);
    }

    if (staffMatch && request.method === 'DELETE') {
      await supabase(env, 'shifts', {
        method: 'DELETE',
        query: { staff_id: `eq.${staffMatch[1]}` },
      });
      await supabase(env, 'staff', {
        method: 'DELETE',
        query: { id: `eq.${staffMatch[1]}` },
      });
      return json({ success: true, message: 'Staff member deleted' });
    }

    if (url.pathname === '/api/shifts' && request.method === 'GET') {
      const query = { select: '*' };
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      if (startDate && endDate) {
        query.shift_date = `gte.${startDate}`;
        query.shift_date_lte = { key: 'shift_date', value: `lte.${endDate}` };
      }
      return json(await supabase(env, 'shifts', { query }));
    }

    if (url.pathname === '/api/shifts/toggle' && request.method === 'POST') {
      const { staff_id, shift_date, shift_count } = await request.json();
      if (!staff_id || !shift_date) {
        return json({ error: 'staff_id and shift_date are required' }, 400);
      }

      const existing = await supabase(env, 'shifts', {
        query: {
          select: '*',
          staff_id: `eq.${staff_id}`,
          shift_date: `eq.${shift_date}`,
        },
      });

      if (existing.length > 0) {
        await supabase(env, 'shifts', {
          method: 'DELETE',
          query: {
            staff_id: `eq.${staff_id}`,
            shift_date: `eq.${shift_date}`,
          },
        });
        return json({ status: 'removed', staff_id, shift_date });
      }

      const inserted = await supabase(env, 'shifts', {
        method: 'POST',
        body: {
          staff_id,
          shift_date,
          shift_count: parseFloat(shift_count) || 1.0,
        },
        preferRepresentation: true,
      });
      return json({ status: 'added', shift: inserted[0] }, 201);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const { username, password } = await request.json();
      if (!username || !password) {
        return json({ error: 'Username and password are required' }, 400);
      }

      const normalizedInput = resolveUsername(username).toLowerCase();
      const users = await supabase(env, 'app_users', {
        query: { select: '*' },
      });
      const user = users.find((candidate) => {
        const candidateUsername = String(candidate.username || '').toLowerCase();
        const candidateEmail = String(candidate.email || '').toLowerCase();
        return candidateUsername === normalizedInput || candidateEmail === normalizedInput;
      });

      if (!user || user.password !== password) {
        return json({ error: 'Incorrect Username or Password' }, 401);
      }

      return json({
        success: true,
        user: {
          id: user.id || `mock-id-${String(user.username).toLowerCase()}`,
          email: user.email || `${String(user.username).toLowerCase().replace(/\s+/g, '_')}@hospital.com`,
          role: user.role,
          department: user.department,
        },
      });
    }

    if (url.pathname === '/api/users' && request.method === 'GET') {
      const data = await supabase(env, 'app_users', {
        query: { select: '*', order: 'username.asc' },
      });
      return json(data);
    }

    if (url.pathname === '/api/users' && request.method === 'POST') {
      const body = await request.json();
      const { username, password, role, department } = body;
      if (!username || !password || !role) {
        return json({ error: 'Username, password, and role are required' }, 400);
      }

      const data = await supabase(env, 'app_users', {
        method: 'POST',
        body: { username, password, role, department: department || null },
        preferRepresentation: true,
      });
      return json(data[0], 201);
    }

    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && request.method === 'PUT') {
      const body = await request.json();
      const data = await supabase(env, 'app_users', {
        method: 'PATCH',
        query: { id: `eq.${userMatch[1]}` },
        body: {
          username: body.username,
          password: body.password,
          role: body.role,
          department: body.department || null,
        },
        preferRepresentation: true,
      });
      if (data.length === 0) return json({ error: 'User not found' }, 404);
      return json(data[0]);
    }

    if (userMatch && request.method === 'DELETE') {
      await supabase(env, 'app_users', {
        method: 'DELETE',
        query: { id: `eq.${userMatch[1]}` },
      });
      return json({ success: true, message: 'User deleted' });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (error) {
    return json({ error: error.message || 'Internal Server Error' }, 500);
  }
}

function isSupabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

async function supabase(env, table, options = {}) {
  const endpoint = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  appendQuery(endpoint.searchParams, options.query || {});

  const headers = {
    apikey: env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (options.preferRepresentation) {
    headers.prefer = 'return=representation';
  }

  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed with status ${response.status}`);
  }

  if (response.status === 204) return [];
  return response.json();
}

function appendQuery(searchParams, query) {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && value.key && value.value) {
      searchParams.append(value.key, value.value);
    } else {
      searchParams.append(key, value);
    }
  }
}

function resolveUsername(username) {
  let resolvedUsername = String(username).trim();
  for (const [laoKey, englishValue] of Object.entries(USERNAME_PREFIX_MAP)) {
    if (resolvedUsername.startsWith(laoKey)) {
      resolvedUsername = englishValue + resolvedUsername.substring(laoKey.length);
      break;
    }
  }
  return resolvedUsername;
}

function sortByName(rows) {
  return [...rows].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'lo-LA'));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}
