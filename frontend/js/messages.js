// HomeSphere In-App Property Chat & Multilingual Communication System

let currentPropertyId = null;
let currentOtherUserId = null;
let activeThreadData = null;
let pollingInterval = null;
let allConversations = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('homesphere_token');
  const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');

  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  // Load conversations inbox
  await loadConversations(token);

  // Check URL query parameters (e.g. ?propertyId=1&sellerId=2)
  const urlParams = new URLSearchParams(window.location.search);
  const paramPropId = urlParams.get('propertyId');
  const paramOtherId = urlParams.get('sellerId') || urlParams.get('otherUserId');

  if (paramPropId && paramOtherId) {
    await openThread(parseInt(paramPropId), parseInt(paramOtherId), token);
  } else if (allConversations.length > 0) {
    const first = allConversations[0];
    await openThread(first.property_id, first.other_user_id, token);
  }

  // Search filter
  document.getElementById('conversationSearchInput')?.addEventListener('input', (e) => {
    filterConversations(e.target.value);
  });

  // Message form submit
  document.getElementById('chatMessageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSendMessage(token);
  });

  // Press Enter to send (Shift+Enter for newline)
  document.getElementById('chatInputMessage')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('chatMessageForm')?.requestSubmit();
    }
  });

  // Start real-time polling every 3.5 seconds
  pollingInterval = setInterval(async () => {
    if (currentPropertyId && currentOtherUserId) {
      await pollActiveThread(token);
    }
    await loadUnreadCount(token);
  }, 3500);
});

// Load Inbox Conversations List
async function loadConversations(token) {
  const container = document.getElementById('threadsList');
  if (!container) return;

  try {
    const res = await fetch('/api/messages/conversations', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load conversations.');

    allConversations = data.data || [];
    renderConversationsList(allConversations);
    await loadUnreadCount(token);
  } catch (err) {
    container.innerHTML = `<p class="text-rose" style="padding:1rem;">${err.message}</p>`;
  }
}

// Render Conversations in Sidebar
function renderConversationsList(threads) {
  const container = document.getElementById('threadsList');
  if (!container) return;

  if (threads.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:var(--text-muted);">
        <i class="fas fa-inbox" style="font-size:2rem;margin-bottom:0.5rem;opacity:0.4;"></i>
        <p style="font-size:0.85rem;">No active conversations yet.</p>
        <a href="/properties.html" class="btn btn-secondary btn-sm" style="margin-top:0.75rem;">Browse Listings</a>
      </div>
    `;
    return;
  }

  container.innerHTML = threads.map((t) => {
    const isActive = currentPropertyId === t.property_id && currentOtherUserId === t.other_user_id;
    const timeFormatted = formatTimeAgo(t.last_message_time);
    const avatarUrl = t.other_user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';

    return `
      <div class="thread-item ${isActive ? 'active' : ''}" onclick="openThread(${t.property_id}, ${t.other_user_id}, localStorage.getItem('homesphere_token'))">
        <div class="thread-avatar-wrapper">
          <img src="${avatarUrl}" class="thread-avatar" alt="${escapeHtml(t.other_user_name)}">
          <img src="${t.primary_image || '/images/no-property-image.svg'}" class="thread-prop-mini" alt="Property">
        </div>
        <div class="thread-info">
          <div class="thread-header-line">
            <span class="thread-user-name">${escapeHtml(t.other_user_name)}</span>
            <span class="thread-time">${timeFormatted}</span>
          </div>
          <div class="thread-prop-title"><i class="fas fa-building"></i> ${escapeHtml(t.property_title)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="thread-last-msg">${escapeHtml(t.last_message)}</span>
            ${t.unread_count > 0 ? `<span class="thread-unread-badge">${t.unread_count}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Filter Conversations by Search Query
function filterConversations(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderConversationsList(allConversations);
    return;
  }
  const filtered = allConversations.filter((t) =>
    (t.other_user_name && t.other_user_name.toLowerCase().includes(q)) ||
    (t.property_title && t.property_title.toLowerCase().includes(q)) ||
    (t.last_message && t.last_message.toLowerCase().includes(q))
  );
  renderConversationsList(filtered);
}

// Open Specific Property Thread
async function openThread(propertyId, otherUserId, token) {
  currentPropertyId = propertyId;
  currentOtherUserId = otherUserId;

  // Highlight active thread in sidebar
  document.querySelectorAll('.thread-item').forEach((elem) => {
    elem.classList.remove('active');
  });

  const emptyState = document.getElementById('chatEmptyState');
  const chatWrapper = document.getElementById('activeChatWrapper');
  if (emptyState) emptyState.style.display = 'none';
  if (chatWrapper) chatWrapper.style.display = 'flex';

  try {
    const res = await fetch(`/api/messages/thread/${propertyId}/${otherUserId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      // If thread not initiated yet, fetch property details to initialize clean chat state
      const propRes = await fetch(`/api/properties/${propertyId}`);
      const propData = await propRes.json();
      if (propData.success) {
        setupNewChatContext(propData.data, otherUserId);
        return;
      }
      throw new Error(data.message || 'Could not load conversation.');
    }

    activeThreadData = data.data;
    renderActiveChat(activeThreadData);
    await loadAISuggestions(propertyId, activeThreadData.messages, token);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Render Active Chat Header, Quick Actions, and Messages Stream
function renderActiveChat(thread) {
  const p = thread.property || {};
  const user = thread.other_user || {};

  // Update Header Elements
  if (document.getElementById('chatPartnerName')) document.getElementById('chatPartnerName').textContent = user.name || 'Member';
  if (document.getElementById('chatPartnerRole')) document.getElementById('chatPartnerRole').textContent = (user.role || 'MEMBER').toUpperCase();
  if (document.getElementById('chatPartnerAvatar')) document.getElementById('chatPartnerAvatar').src = user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';

  const priceFormatted = Number(p.price || 0).toLocaleString();
  const priceDisplay = (p.type === 'rent' || p.type === 'lease') ? `₹${priceFormatted}/mo` : `₹${priceFormatted}`;

  if (document.getElementById('chatPropTitle')) document.getElementById('chatPropTitle').textContent = p.title || 'Property';
  if (document.getElementById('chatPropPrice')) document.getElementById('chatPropPrice').textContent = priceDisplay;
  if (document.getElementById('chatPropThumb')) document.getElementById('chatPropThumb').src = p.primary_image || '/images/no-property-image.svg';

  // Update Quick Action Buttons
  if (document.getElementById('actionScheduleVisitBtn')) document.getElementById('actionScheduleVisitBtn').href = `/property-details.html?id=${p.id}#scheduleVisitModal`;
  if (document.getElementById('actionVirtualTourBtn')) document.getElementById('actionVirtualTourBtn').href = `/property-details.html?id=${p.id}#virtualTourCard`;
  if (document.getElementById('actionMakeOfferBtn')) document.getElementById('actionMakeOfferBtn').href = p.type === 'rent' ? `/property-details.html?id=${p.id}#rentalAppModal` : `/property-details.html?id=${p.id}#makeOfferModal`;
  if (document.getElementById('actionViewPropBtn')) document.getElementById('actionViewPropBtn').href = `/property-details.html?id=${p.id}`;

  // Render Messages Stream
  const currentUserId = JSON.parse(localStorage.getItem('homesphere_user') || '{}').id;
  const stream = document.getElementById('messagesStream');
  if (!stream) return;

  if (!thread.messages || thread.messages.length === 0) {
    stream.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
        <i class="fas fa-handshake" style="font-size:2.5rem;color:var(--accent-cyan);margin-bottom:0.75rem;opacity:0.8;"></i>
        <h4>Direct Property Channel</h4>
        <p style="font-size:0.85rem;margin-top:0.35rem;">Ask questions about price negotiation, schedule viewings, or confirm lease terms below.</p>
      </div>
    `;
    return;
  }

  stream.innerHTML = thread.messages.map((m) => {
    const isOutgoing = m.sender_id === currentUserId;
    const timeFormatted = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const escapedMsg = escapeHtml(m.message);

    return `
      <div class="message-bubble-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}" id="msg-wrap-${m.id}">
        <div class="message-sender-name">${isOutgoing ? 'You' : escapeHtml(m.sender_name || 'Seller')}</div>
        <div class="message-bubble" id="msg-body-${m.id}">${escapedMsg}</div>
        <div id="msg-trans-${m.id}" class="message-translation-box" style="display:none; font-size:0.85rem; color:var(--text-secondary); background:rgba(0,0,0,0.05); padding:0.4rem 0.6rem; border-radius:6px; margin-top:0.3rem;"></div>
        <div class="message-meta" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
          <div>
            <span>${timeFormatted}</span>
            ${isOutgoing ? `<i class="fas fa-check-double ${m.is_read ? 'text-cyan' : ''}" title="${m.is_read ? 'Read' : 'Delivered'}"></i>` : ''}
          </div>
          <button type="button" class="btn-translate-msg" onclick="translateMessage(${m.id}, this)" style="background:none; border:none; color:var(--accent-cyan); font-size:0.75rem; cursor:pointer; padding:0; display:inline-flex; align-items:center; gap:0.25rem;">
            <i class="fas fa-language"></i> Translate
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Auto-scroll to latest message
  stream.scrollTop = stream.scrollHeight;
}

// Multilingual Dynamic Translation Handler
window.translateMessage = async function(msgId, btn) {
  const transBox = document.getElementById(`msg-trans-${msgId}`);
  const msgBody = document.getElementById(`msg-body-${msgId}`);
  if (!transBox || !msgBody) return;

  const text = msgBody.textContent;

  if (transBox.style.display !== 'none' && transBox.getAttribute('data-loaded') === 'true') {
    // Toggle hide
    transBox.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-language"></i> Translate';
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
  const token = localStorage.getItem('homesphere_token');

  try {
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    const targetLang = isTamil ? 'en' : 'ta';

    const res = await fetch('/api/messages/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message_id: msgId, text, target_lang: targetLang })
    });
    const data = await res.json();

    if (data.success && data.data) {
      const translated = data.data.translated_message;
      const langLabel = targetLang === 'en' ? 'English' : 'தமிழ் (Tamil)';
      transBox.innerHTML = `<strong>🌐 ${langLabel}:</strong> ${escapeHtml(translated)}`;
      transBox.style.display = 'block';
      transBox.setAttribute('data-loaded', 'true');
      btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
    } else {
      transBox.innerHTML = `<span class="text-rose">Translation unavailable.</span>`;
      transBox.style.display = 'block';
      btn.innerHTML = '<i class="fas fa-language"></i> Retry';
    }
  } catch (err) {
    transBox.innerHTML = `<span class="text-rose">Translation error: ${escapeHtml(err.message)}</span>`;
    transBox.style.display = 'block';
    btn.innerHTML = '<i class="fas fa-language"></i> Retry';
  }
};

// Setup Clean Chat Context for newly initiated conversation
function setupNewChatContext(prop, otherUserId) {
  activeThreadData = {
    property: {
      id: prop.id,
      title: prop.title,
      price: prop.price,
      type: prop.type,
      primary_image: prop.primary_image || (prop.images?.[0]?.image_url) || '/images/no-property-image.svg',
      owner_id: prop.owner_id
    },
    other_user: {
      id: otherUserId,
      name: prop.owner_name || 'Property Owner',
      role: 'Member',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80'
    },
    messages: []
  };
  renderActiveChat(activeThreadData);
  loadAISuggestions(prop.id, [], localStorage.getItem('homesphere_token'));
}

// Send Message Handler
async function handleSendMessage(token) {
  const input = document.getElementById('chatInputMessage');
  if (!input || !currentPropertyId || !currentOtherUserId) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        property_id: currentPropertyId,
        receiver_id: currentOtherUserId,
        message: text
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send message.');

    // Refresh active thread
    await pollActiveThread(token);
    await loadConversations(token);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Poll Active Thread Messages
async function pollActiveThread(token) {
  if (!currentPropertyId || !currentOtherUserId) return;
  try {
    const res = await fetch(`/api/messages/thread/${currentPropertyId}/${currentOtherUserId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success && data.data) {
      activeThreadData = data.data;
      renderActiveChat(activeThreadData);
    }
  } catch (e) {
    // Non-blocking poll error
  }
}

// Load Unread Count
async function loadUnreadCount(token) {
  try {
    const res = await fetch('/api/messages/unread-count', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const count = data.data.unread_count || 0;
      document.querySelectorAll('.unread-messages-count').forEach((el) => {
        el.textContent = count;
        el.style.display = count > 0 ? 'inline-block' : 'none';
      });
    }
  } catch (e) {}
}

// Load AI Suggested Replies
async function loadAISuggestions(propertyId, messages, token) {
  const container = document.getElementById('aiSuggestionsContainer');
  if (!container) return;

  try {
    const user = JSON.parse(localStorage.getItem('homesphere_user') || '{}');
    const isSeller = activeThreadData?.property?.owner_id === user.id;
    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1].message : '';

    const res = await fetch('/api/messages/ai-suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        property_id: propertyId,
        last_message: lastMsg,
        is_seller: isSeller
      })
    });
    const data = await res.json();

    if (res.ok && data.success && data.data?.suggestions) {
      container.innerHTML = data.data.suggestions.map((s) => `
        <button type="button" class="ai-suggestion-chip" onclick="applySuggestion('${escapeHtml(s).replace(/'/g, "\\'")}')">
          <i class="fas fa-sparkles text-purple"></i> ${escapeHtml(s)}
        </button>
      `).join('');
    }
  } catch (e) {}
}

window.applySuggestion = function(text) {
  const input = document.getElementById('chatInputMessage');
  if (input) {
    input.value = text;
    input.focus();
  }
};

// Utilities
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  console.log(`[Toast ${type}] ${msg}`);
}
