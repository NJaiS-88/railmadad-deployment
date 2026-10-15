// staffClient.js
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/auth';

async function request(path, options = {}) {
  const token = localStorage.getItem('staff_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Request failed');
  }

  return response.json();
}

export const staffClient = {
  // Authentication
  loginStaff: async (phone, password) => {
    const res = await request('/staff/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    localStorage.setItem('staff_token', res.token);
    localStorage.setItem('activeStaff', JSON.stringify(res.staff));
    return res.staff;
  },

  getCurrentStaff: () => {
    const active = localStorage.getItem('activeStaff');
    return active ? JSON.parse(active) : null;
  },

  // Fetch fresh staff profile (rating, tasks completed, feedback) from backend
  getProfile: async () => {
    const res = await request('/staff/me');
    localStorage.setItem('activeStaff', JSON.stringify(res));
    return res;
  },

  logoutStaff: () => {
    localStorage.removeItem('activeStaff');
    localStorage.removeItem('staff_token');
  },

  checkDuplicates: async (phone, idCardNumber) => {
    return request('/staff/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ phone, idCardNumber })
    });
  },

  registerStaff: async (staffData) => {
    const res = await request('/staff/register', {
      method: 'POST',
      body: JSON.stringify(staffData)
    });
    // Do not auto-login newly registered staff. They must wait for officer approval.
    return res.staff;
  },

  // Update staff status (Available, Offline)
  updateStaffStatus: async (status) => {
    const res = await request('/staff/status', {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    localStorage.setItem('activeStaff', JSON.stringify(res));
    return res;
  },

  // Get tasks assigned to active staff
  getTasks: async () => {
    try {
      const active = staffClient.getCurrentStaff();
      if (!active) return [];
      return await request('/staff/tasks');
    } catch (err) {
      console.error('Failed to get tasks:', err.message);
      return [];
    }
  },

  // Accept a task
  acceptTask: async (taskId) => {
    const res = await request(`/staff/tasks/${taskId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' })
    });
    return res.complaint || res;
  },

  // Start Action / In Progress
  startTaskAction: async (taskId) => {
    const res = await request(`/staff/tasks/${taskId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'start' })
    });
    console.log('[staffClient] Start action response:', res);
    return res.complaint || res;
  },

  // Reject task
  rejectTask: async (taskId, reason) => {
    const res = await request(`/staff/tasks/${taskId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', reason })
    });
    return res.complaint || res;
  },

  // Resolve task
  submitResolution: async (taskId, actionTaken, remarks, proofImage) => {
    const res = await request(`/staff/tasks/${taskId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'resolve', actionTaken, remarks, proofImage })
    });
    return res.complaint || res;
  },

};
