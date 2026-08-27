/**
 * HomeSphere - Login Controller
 */

function togglePassVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isPass ? 'far fa-eye-slash' : 'far fa-eye';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmitBtn');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success && data.data) {
      localStorage.setItem('homesphere_token', data.data.token);
      localStorage.setItem('homesphere_user', JSON.stringify(data.data.user));

      showToast('Login successful! Redirecting to dashboard...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 700);
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
      showToast(data.message || 'Invalid email or password.', 'error');
    }
  } catch (err) {
    console.error('Login error', err);
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
    showToast('Failed to connect to authentication server. Please try again.', 'error');
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;margin-left:auto;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
