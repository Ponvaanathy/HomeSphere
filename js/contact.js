// HomeSphere Contact & FAQ Page Logic

document.addEventListener('DOMContentLoaded', () => {
  // Accordion Toggles
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      item.classList.toggle('active');
    });
  });

  // Contact Form Submission
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    // Autofill user info if logged in
    const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');
    if (user) {
      const nameInput = document.getElementById('contactName');
      const emailInput = document.getElementById('contactEmail');
      const phoneInput = document.getElementById('contactPhone');
      if (nameInput) nameInput.value = user.name;
      if (emailInput) emailInput.value = user.email;
      if (phoneInput && user.phone) phoneInput.value = user.phone;
    }

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const phone = document.getElementById('contactPhone')?.value.trim() || '';
      const message = document.getElementById('contactMessage').value.trim();
      const submitBtn = document.getElementById('contactSubmitBtn');

      if (!name || !email || !message) {
        showToast('Please fill in your name, email, and message.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting...';

      try {
        const token = localStorage.getItem('homesphere_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/contact', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name,
            email,
            phone,
            message,
            inquiry_type: 'general'
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit inquiry.');

        showToast('Your message has been received! Our support team will reply promptly.', 'success');
        contactForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Message';
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Message';
      }
    });
  }
});

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
