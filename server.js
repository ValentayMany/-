const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Mode Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

let supabase = null;
if (isSupabaseConfigured) {
  console.log('⚡ Supabase is configured. Connecting to live database...');
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.log('💾 Running in MOCK MODE using local data/mock_db.json');
}

const MOCK_DB_PATH = path.join(__dirname, 'data', 'mock_db.json');
const USERS_DB_PATH = path.join(__dirname, 'data', 'users.json');

// Helper to read Mock DB
async function readMockDb() {
  try {
    const data = await fs.readFile(MOCK_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading mock DB, initializing empty structure:', error);
    const emptyDb = { staff: [], shifts: [] };
    await fs.writeFile(MOCK_DB_PATH, JSON.stringify(emptyDb, null, 2), 'utf8');
    return emptyDb;
  }
}

// Helper to write Mock DB
async function writeMockDb(data) {
  await fs.writeFile(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Helper to read users DB
async function readUsersDb() {
  try {
    const data = await fs.readFile(USERS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users DB:', error);
    return [];
  }
}

// Helper to write users DB
async function writeUsersDb(data) {
  await fs.writeFile(USERS_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// --- STAFF ENDPOINTS ---

// Get all staff members
app.get('/api/staff', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return res.json(data);
    } else {
      const db = await readMockDb();
      // Sort alphabetically by name
      const sortedStaff = db.staff.sort((a, b) => a.name.localeCompare(b.name, 'lo-LA'));
      return res.json(sortedStaff);
    }
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Add a staff member
app.post('/api/staff', async (req, res) => {
  const { name, department, rate_per_shift, notes } = req.body;
  if (!name || !department) {
    return res.status(400).json({ error: 'Name and department are required' });
  }

  try {
    const rate = Number(rate_per_shift) || 0;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('staff')
        .insert([{ name, department, rate_per_shift: rate, notes: notes || '' }])
        .select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    } else {
      const db = await readMockDb();
      const newStaff = {
        id: `staff-${Date.now()}`,
        name,
        department,
        rate_per_shift: rate,
        notes: notes || ''
      };
      db.staff.push(newStaff);
      await writeMockDb(db);
      return res.status(201).json(newStaff);
    }
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Update a staff member
app.put('/api/staff/:id', async (req, res) => {
  const { id } = req.params;
  const { name, department, rate_per_shift, notes } = req.body;

  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('staff')
        .update({ name, department, rate_per_shift: Number(rate_per_shift) || 0, notes })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (data.length === 0) return res.status(404).json({ error: 'Staff member not found' });
      return res.json(data[0]);
    } else {
      const db = await readMockDb();
      const idx = db.staff.findIndex(s => s.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Staff member not found' });

      db.staff[idx] = {
        ...db.staff[idx],
        name: name !== undefined ? name : db.staff[idx].name,
        department: department !== undefined ? department : db.staff[idx].department,
        rate_per_shift: rate_per_shift !== undefined ? Number(rate_per_shift) || 0 : db.staff[idx].rate_per_shift,
        notes: notes !== undefined ? notes : db.staff[idx].notes
      };
      await writeMockDb(db);
      return res.json(db.staff[idx]);
    }
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Delete a staff member
app.delete('/api/staff/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Staff member deleted' });
    } else {
      const db = await readMockDb();
      db.staff = db.staff.filter(s => s.id !== id);
      // Cascade delete shifts for this staff
      db.shifts = db.shifts.filter(s => s.staff_id !== id);
      await writeMockDb(db);
      return res.json({ success: true, message: 'Staff member deleted' });
    }
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// --- SHIFT ENDPOINTS ---

// Get shifts in a date range
app.get('/api/shifts', async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    if (isSupabaseConfigured) {
      let query = supabase.from('shifts').select('*');
      if (start_date && end_date) {
        query = query.gte('shift_date', start_date).lte('shift_date', end_date);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.json(data);
    } else {
      const db = await readMockDb();
      let filteredShifts = db.shifts;
      if (start_date && end_date) {
        filteredShifts = db.shifts.filter(s => 
          s.shift_date >= start_date && s.shift_date <= end_date
        );
      }
      return res.json(filteredShifts);
    }
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Toggle a shift
// If shift exists for staff on date, remove it. If not, add it.
app.post('/api/shifts/toggle', async (req, res) => {
  const { staff_id, shift_date, shift_count } = req.body;
  if (!staff_id || !shift_date) {
    return res.status(400).json({ error: 'staff_id and shift_date are required' });
  }

  const count = parseFloat(shift_count) || 1.0;

  try {
    if (isSupabaseConfigured) {
      // Check if shift already exists
      const { data: existing, error: fetchErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('staff_id', staff_id)
        .eq('shift_date', shift_date);

      if (fetchErr) throw fetchErr;

      if (existing && existing.length > 0) {
        // Shift exists, delete it
        const { error: delErr } = await supabase
          .from('shifts')
          .delete()
          .eq('staff_id', staff_id)
          .eq('shift_date', shift_date);

        if (delErr) throw delErr;
        return res.json({ status: 'removed', staff_id, shift_date });
      } else {
        // Shift doesn't exist, insert it
        const { data: inserted, error: insErr } = await supabase
          .from('shifts')
          .insert([{ staff_id, shift_date, shift_count: count }])
          .select();

        if (insErr) throw insErr;
        return res.status(201).json({ status: 'added', shift: inserted[0] });
      }
    } else {
      const db = await readMockDb();
      const existingIdx = db.shifts.findIndex(s => 
        s.staff_id === staff_id && s.shift_date === shift_date
      );

      if (existingIdx !== -1) {
        // Remove shift
        db.shifts.splice(existingIdx, 1);
        await writeMockDb(db);
        return res.json({ status: 'removed', staff_id, shift_date });
      } else {
        // Add shift
        const newShift = {
          id: `shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          staff_id,
          shift_date,
          shift_count: count
        };
        db.shifts.push(newShift);
        await writeMockDb(db);
        return res.status(201).json({ status: 'added', shift: newShift });
      }
    }
  } catch (error) {
    console.error('Error toggling shift:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// --- LOCAL AUTH ENDPOINT ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    let user = null;
    
    // Resolve input name dynamically (e.g. "ການຢາ1" -> "Pharmacy1")
    const USERNAME_PREFIX_MAP = {
      'ການຢາ': 'Pharmacy',
      'ພະຍາບານ': 'Nurse',
      'ພາຍໃນ': 'Internal medicine',
      'ເດັກນ້ອຍ': 'Pediatric Department',
      'ວິເຄາະ': 'Laboratory Department',
      'ໂຊເຟີ': 'Chauffeur',
      'ຜູ້ດູແລ': 'Admin'
    };

    let resolvedUsername = username.trim();
    for (const [laoKey, engValue] of Object.entries(USERNAME_PREFIX_MAP)) {
      if (resolvedUsername.startsWith(laoKey)) {
        resolvedUsername = engValue + resolvedUsername.substring(laoKey.length);
        break;
      }
    }

    const normalizedInput = resolvedUsername.toLowerCase();

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('app_users')
        .select('*');
      if (error) throw error;

      user = data.find(u => 
        u.username.toLowerCase() === normalizedInput || 
        (u.email && u.email.toLowerCase() === normalizedInput)
      );
    } else {
      const users = await readUsersDb();
      user = users.find(u => 
        u.username.toLowerCase() === normalizedInput || 
        (u.email && u.email.toLowerCase() === normalizedInput)
      );
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ (Incorrect Username or Password)' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id || `mock-id-${user.username.toLowerCase()}`,
        email: user.email || `${user.username.toLowerCase().replace(/\s+/g, '_')}@hospital.com`,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- USER MANAGEMENT ENDPOINTS ---

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('username', { ascending: true });
      if (error) throw error;
      return res.json(data);
    } else {
      const users = await readUsersDb();
      const sortedUsers = users.sort((a, b) => a.username.localeCompare(b.username));
      return res.json(sortedUsers);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Add a user
app.post('/api/users', async (req, res) => {
  const { username, password, role, department } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('app_users')
        .insert([{ username, password, role, department: department || null }])
        .select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    } else {
      const users = await readUsersDb();
      if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      const newUser = {
        id: `user-${Date.now()}`,
        username,
        email: `${username.toLowerCase().replace(/\s+/g, '_')}@hospital.com`,
        password,
        role,
        department: department || null
      };
      users.push(newUser);
      await writeUsersDb(users);
      return res.status(201).json(newUser);
    }
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Update a user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, department } = req.body;

  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('app_users')
        .update({ username, password, role, department: department || null })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (data.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.json(data[0]);
    } else {
      const users = await readUsersDb();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });

      users[idx] = {
        ...users[idx],
        username: username !== undefined ? username : users[idx].username,
        password: password !== undefined ? password : users[idx].password,
        role: role !== undefined ? role : users[idx].role,
        department: department !== undefined ? department : users[idx].department
      };
      await writeUsersDb(users);
      return res.json(users[idx]);
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'User deleted' });
    } else {
      const users = await readUsersDb();
      const newUsers = users.filter(u => u.id !== id);
      await writeUsersDb(newUsers);
      return res.json({ success: true, message: 'User deleted' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// --- CONFIG ENDPOINT (for frontend Supabase Auth) ---
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: supabaseUrl || '',
    supabaseAnonKey: supabaseKey || '',
    isSupabaseConfigured
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📂 Web interface is served from the /public folder`);
});
