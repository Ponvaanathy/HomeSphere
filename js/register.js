/**
 * HomeSphere - Registration Controller (Single User Account)
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

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('regSubmitBtn');
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        password,
        role: 'user'
      })
    });

    const data = await res.json();

    if (data.success && data.data) {
      localStorage.setItem('homesphere_token', data.data.token);
      localStorage.setItem('homesphere_user', JSON.stringify(data.data.user));

      showToast('Account created successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 700);
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Create Account';
      showToast(data.message || 'Registration failed. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Register error', err);
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
    showToast('Registration service unavailable. Please try again.', 'error');
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

