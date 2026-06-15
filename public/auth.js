/**
 * auth.js - Client Session Manager
 * Handles local session management, role/department configuration, and access control.
 * Must be loaded BEFORE app.js in index.html.
 */

// Global auth state
window.AppAuth = {
  session: null,
  profile: null,   // { id, email, role, department }
  isAdmin: false,
  isReady: false,
};

function initAuth() {
  try {
    const localSessionStr = localStorage.getItem('mock_session');
    if (!localSessionStr) {
      redirectToLogin();
      return;
    }

    const localUser = JSON.parse(localSessionStr);
    window.AppAuth.session = { access_token: 'mock-token', user: localUser };
    window.AppAuth.profile = localUser;
    window.AppAuth.isAdmin = localUser.role === 'admin';
    window.AppAuth.isReady = true;

    console.log(`[Auth] Logged in as ${localUser.email} | Role: ${localUser.role} | Dept: ${localUser.department || 'ALL'}`);

  } catch (err) {
    console.error('[Auth] Init error:', err);
    redirectToLogin();
  }
}

function redirectToLogin() {
  if (!window.location.pathname.endsWith('login.html')) {
    window.location.href = '/login.html';
  }
}

function logout() {
  localStorage.removeItem('mock_session');
  redirectToLogin();
}

// Start auth immediately
initAuth();
