/**
 * HomeSphere - AI Home Advisor Conversational Assistant (Premium UI & Real Data)
 */

let activePropertyId = null;
let conversationHistory = [];
let allPropertiesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Auth state
  const token = localStorage.getItem('homesphere_token');
  const authActions = document.getElementById('navAuthActions');
  const brandLogoLink = document.getElementById('brandLogoLink');
  if (token) {
    if (brandLogoLink) brandLogoLink.href = '/dashboard.html';
    if (authActions) {
      let userName = 'Profile';
      let userInit = 'U';
      try {
        const u = JSON.parse(localStorage.getItem('homesphere_user') || '{}');
        if (u.name) {
          userName = u.name;
          userInit = u.name.charAt(0).toUpperCase();
        }
      } catch (e) {}
      authActions.innerHTML = `
        <a href="/profile.html" class="nav-profile-header-link" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.25rem 0.65rem; border-radius: 50px; background: var(--bg-surface-alt); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.8125rem; font-weight: 600;" title="View Profile">
          <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--brand-primary); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${userInit}</div>
          <span class="hide-mobile">${userName}</span>
        </a>
        <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
      `;
    }
  }


  const urlParams = new URLSearchParams(window.location.search);
  const paramPropId = urlParams.get('propertyId');

  await populatePropertyContextSelector(paramPropId);
  setupInteractivePrompts();
});

function setupInteractivePrompts() {
  // Quick Action Cards
  document.querySelectorAll('.quick-action-card').forEach((card) => {
    card.addEventListener('click', () => {
      const promptText = card.dataset.prompt || card.querySelector('.quick-action-title')?.textContent;
      if (promptText) {
        sendPredefinedPrompt(promptText);
      }
    });
  });

  // Suggestion Chips
  document.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt || chip.textContent.trim();
      if (promptText) {
        sendPredefinedPrompt(promptText);
      }
    });
  });
}

function sendPredefinedPrompt(promptText) {
  const input = document.getElementById('advisorInput');
  if (input) {
    input.value = promptText;
    sendMessage();
  }
}

async function populatePropertyContextSelector(selectedId) {
  const selectElem = document.getElementById('propertyContextSelect');
  if (!selectElem) return;

  try {
    const res = await fetch('/api/properties?limit=40');
    const data = await res.json();

    if (data.success && data.data && Array.isArray(data.data.properties)) {
      allPropertiesCache = data.data.properties;
      let optionsHtml = '<option value="">🌐 General Market Guidance</option>';

      allPropertiesCache.forEach((p) => {
        const isSelected = selectedId && String(p.id) === String(selectedId) ? 'selected' : '';
        let priceFmt = `₹${Number(p.price).toLocaleString()}`;
        if (p.price >= 10000000) priceFmt = `₹${(p.price / 10000000).toFixed(2)} Cr`;
        else if (p.price >= 100000) priceFmt = `₹${(p.price / 100000).toFixed(2)} Lakhs`;
        if (p.type === 'rent' || p.type === 'lease') priceFmt += '/mo';

        optionsHtml += `<option value="${p.id}" ${isSelected}>🏡 ${p.title} (${p.city || ''} - ${priceFmt})</option>`;
      });

      selectElem.innerHTML = optionsHtml;

      if (selectedId) {
        activePropertyId = selectedId;
        await updateInsightsPanel(selectedId);
        const currentProp = allPropertiesCache.find((p) => String(p.id) === String(selectedId));
        if (currentProp) {
          appendBotMessage(`Hello! I see you are evaluating **${currentProp.title}** in ${currentProp.city || 'the market'}. Ask me anything about its **Trust Score**, **Hidden Costs**, **Locality LifeScore**, or **Investment Valuation**.`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load property context options:', err);
  }

  selectElem.addEventListener('change', async (e) => {
    activePropertyId = e.target.value || null;
    const selectedText = e.target.options[e.target.selectedIndex].text;

    if (activePropertyId) {
      await updateInsightsPanel(activePropertyId);
      const badge = document.getElementById('chatContextBadge');
      if (badge) {
        badge.className = 'badge badge-sale';
        badge.textContent = 'Property Mode';
      }
      appendBotMessage(`Switched context to **${selectedText}**. How can I help you analyze this listing?`);
    } else {
      showEmptyInsightsState();
      const badge = document.getElementById('chatContextBadge');
      if (badge) {
        badge.className = 'badge badge-trust';
        badge.textContent = 'General Mode';
      }
      appendBotMessage(`Switched to **General Real Estate Decision Guidance**. Ask me anything about buy vs rent decisions, market benchmarks, or legal checklist.`);
    }
  });
}

async function updateInsightsPanel(propertyId) {
  const emptyState = document.getElementById('insightsEmptyState');
  const propBox = document.getElementById('insightsPropertyBox');
  if (!propertyId) {
    showEmptyInsightsState();
    return;
  }

  try {
    const res = await fetch(`/api/properties/${propertyId}`);
    const data = await res.json();
    if (data.success && data.data) {
      const p = data.data;

      if (emptyState) emptyState.style.display = 'none';
      if (propBox) propBox.style.display = 'flex';

      // Set photo
      const imgEl = document.getElementById('insightsPropImg');
      const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
      if (imgEl) {
        imgEl.src = (p.images && p.images.length > 0 && typeof p.images[0] === 'object') ? p.images[0].image_url : (p.primary_image || defaultImg);
      }

      // Title & Location
      if (document.getElementById('insightsPropTitle')) document.getElementById('insightsPropTitle').textContent = p.title || 'Property Listing';
      if (document.getElementById('insightsPropLocation')) {
        document.getElementById('insightsPropLocation').textContent = `${p.address ? p.address + ', ' : ''}${p.city || ''}`;
      }

      // Price & Badge
      let priceDisplay = 'Price on Request';
      if (p.price) {
        const num = Number(p.price);
        if (num >= 10000000) priceDisplay = `₹${(num / 10000000).toFixed(2)} Cr`;
        else if (num >= 100000) priceDisplay = `₹${(num / 100000).toFixed(2)} Lakhs`;
        else priceDisplay = `₹${num.toLocaleString()}`;
        if (p.type === 'rent' || p.type === 'lease') priceDisplay += '/mo';
      }
      if (document.getElementById('insightsPropPrice')) document.getElementById('insightsPropPrice').textContent = priceDisplay;

      const typeBadge = document.getElementById('insightsPropTypeBadge');
      if (typeBadge) {
        if (p.type === 'rent') {
          typeBadge.className = 'badge badge-rent';
          typeBadge.textContent = 'FOR RENT';
        } else if (p.type === 'lease') {
          typeBadge.className = 'badge badge-lease';
          typeBadge.textContent = 'FOR LEASE';
        } else {
          typeBadge.className = 'badge badge-sale';
          typeBadge.textContent = 'FOR SALE';
        }
      }

      // Trust Score
      let trust = '—';
      if (p.trust_score) {
        if (typeof p.trust_score === 'number') trust = `${p.trust_score}/100`;
        else if (typeof p.trust_score === 'object' && p.trust_score.score) trust = `${p.trust_score.score}/100`;
      }
      if (document.getElementById('insightsTrustScore')) document.getElementById('insightsTrustScore').textContent = trust;

      // LifeScore
      let life = '—';
      if (p.life_score) {
        if (typeof p.life_score === 'number') life = `${p.life_score}/100`;
        else if (typeof p.life_score === 'object' && p.life_score.score) life = `${p.life_score.score}/100`;
      }
      if (document.getElementById('insightsLifeScore')) document.getElementById('insightsLifeScore').textContent = life;

      // Beds & Area
      if (document.getElementById('insightsBeds')) {
        document.getElementById('insightsBeds').textContent = (p.bedrooms && Number(p.bedrooms) > 0) ? `${p.bedrooms} BHK` : '—';
      }
      if (document.getElementById('insightsArea')) {
        document.getElementById('insightsArea').textContent = (p.area_sqft && Number(p.area_sqft) > 0) ? `${Number(p.area_sqft).toLocaleString()} sqft` : '—';
      }

      // View details link
      const viewLink = document.getElementById('insightsViewLink');
      if (viewLink) viewLink.href = `/property-details.html?id=${p.id}`;
    }
  } catch (err) {
    console.error('Failed to load property insights:', err);
  }
}

function showEmptyInsightsState() {
  const emptyState = document.getElementById('insightsEmptyState');
  const propBox = document.getElementById('insightsPropertyBox');
  if (emptyState) emptyState.style.display = 'block';
  if (propBox) propBox.style.display = 'none';
}

function handleFormSubmit(e) {
  e.preventDefault();
  sendMessage();
}

async function sendMessage() {
  const inputElem = document.getElementById('advisorInput');
  const chatHistoryElem = document.getElementById('chatHistory');
  const query = inputElem?.value.trim();

  if (!query) return;

  // Remove welcome box if still present
  const welcomeBox = document.getElementById('welcomeBox');
  if (welcomeBox) {
    welcomeBox.style.display = 'none';
  }

  appendUserMessage(query);
  if (inputElem) inputElem.value = '';

  const typingElem = document.createElement('div');
  typingElem.className = 'chat-row assistant';
  typingElem.id = 'typingIndicator';
  typingElem.innerHTML = `
    <div class="chat-avatar-badge bot"><i class="fas fa-robot"></i></div>
    <div class="chat-message-bubble">
      <div style="display:flex;align-items:center;gap:0.5rem;color:var(--text-muted);font-size:0.8125rem;">
        <span>AI is analyzing</span>
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  chatHistoryElem.appendChild(typingElem);
  chatHistoryElem.scrollTop = chatHistoryElem.scrollHeight;

  try {
    const res = await fetch('/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        propertyId: activePropertyId,
        conversationHistory
      })
    });

    const data = await res.json();
    typingElem.remove();

    if (data.success && data.data && data.data.reply) {
      appendBotMessage(data.data.reply);
      conversationHistory.push({ role: 'user', content: query });
      conversationHistory.push({ role: 'assistant', content: data.data.reply });

      // Update dynamic suggestion chips from AI response
      if (Array.isArray(data.data.quick_actions) && data.data.quick_actions.length > 0) {
        updateSuggestionChips(data.data.quick_actions);
      }
    } else {
      appendBotMessage('I could not analyze this request at the moment. Please try asking again.');
    }
  } catch (err) {
    typingElem.remove();
    appendBotMessage('Connection error. Please ensure the backend server is active.');
  }
}

function updateSuggestionChips(chips) {
  const bar = document.getElementById('suggestionChipsBar');
  if (!bar || !chips || chips.length === 0) return;

  bar.innerHTML = chips.map(c => `
    <div class="suggestion-chip" data-prompt="${escapeHtml(c.prompt || c.text)}">
      <i class="fas fa-sparkles text-purple"></i> ${escapeHtml(c.text)}
    </div>
  `).join('');

  bar.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt;
      if (promptText) sendPredefinedPrompt(promptText);
    });
  });
}

function appendUserMessage(text) {
  const container = document.getElementById('chatHistory');
  if (!container) return;
  const msgElem = document.createElement('div');
  msgElem.className = 'chat-row user';
  msgElem.innerHTML = `
    <div class="chat-avatar-badge user"><i class="fas fa-user"></i></div>
    <div class="chat-message-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(msgElem);
  container.scrollTop = container.scrollHeight;
}

function appendBotMessage(markdownText) {
  const container = document.getElementById('chatHistory');
  if (!container) return;
  const msgElem = document.createElement('div');
  msgElem.className = 'chat-row assistant';

  let formattedHtml = markdownText
    // Images: ![alt](url)
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; margin: 0.5rem 0; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">')
    // Buttons / Links: [text](url)
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; color: var(--brand-primary); text-decoration: none; margin: 0.25rem 0;">$1</a>')
    // Headers: ### and ####
    .replace(/#### (.*?)\n/g, '<h5 style="color: var(--text-primary); font-size: 0.95rem; margin: 0.6rem 0 0.3rem 0; font-weight: 700;">$1</h5>')
    .replace(/### (.*?)\n/g, '<h4 style="color: var(--text-primary); font-size: 1.05rem; margin: 0.75rem 0 0.35rem 0; font-weight: 800;">$1</h4>')
    // Horizontal rule
    .replace(/\n---\n/g, '<hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0.85rem 0;">')
    // Bold and Italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Paragraphs and bullets
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n\* /g, '<br>• ')
    .replace(/\n- /g, '<br>• ')
    .replace(/✓/g, '<span class="text-emerald">✓</span>')
    .replace(/⚠️/g, '<span class="text-amber">⚠️</span>');

  msgElem.innerHTML = `
    <div class="chat-avatar-badge bot"><i class="fas fa-robot"></i></div>
    <div class="chat-message-bubble">
      <div style="font-size:0.75rem;font-weight:700;color:var(--accent-purple);text-transform:uppercase;margin-bottom:0.35rem;letter-spacing:0.04em;">
        HomeSphere AI Insight
      </div>
      <div style="line-height: 1.6;">${formattedHtml}</div>
    </div>
  `;
  container.appendChild(msgElem);
  container.scrollTop = container.scrollHeight;
}


function resetChatHistory() {
  conversationHistory = [];
  const container = document.getElementById('chatHistory');
  if (!container) return;
  container.innerHTML = `
    <!-- Initial Welcome & Quick Action Card -->
    <div class="ai-welcome-box" id="welcomeBox">
      <div class="ai-welcome-title">
        <i class="fas fa-sparkles text-purple"></i> How can I help you with your property decision?
      </div>
      <p class="ai-welcome-text">
        Ask me about property costs, location intelligence, legal verification, investment potential, or whether buying or renting makes more sense.
      </p>

      <!-- Quick Action Cards Grid -->
      <div class="quick-actions-grid">
        <div class="quick-action-card" data-prompt="What are the estimated hidden costs and total first-year outlay for this property?">
          <div class="quick-action-icon text-amber"><i class="fas fa-calculator"></i></div>
          <div class="quick-action-title">Hidden Costs</div>
          <div class="quick-action-desc">Understand complete closing & setup outlay</div>
        </div>

        <div class="quick-action-card" data-prompt="Is the legal title verified and free of encumbrance risks?">
          <div class="quick-action-icon text-brand"><i class="fas fa-shield-alt"></i></div>
          <div class="quick-action-title">Legal Verification</div>
          <div class="quick-action-desc">Check title deed & legal clearance</div>
        </div>

        <div class="quick-action-card" data-prompt="What is the 5-year capital appreciation forecast for this locality?">
          <div class="quick-action-icon text-emerald"><i class="fas fa-chart-line"></i></div>
          <div class="quick-action-title">Capital Growth</div>
          <div class="quick-action-desc">Explore future 5-year appreciation</div>
        </div>

        <div class="quick-action-card" data-prompt="Analyze the neighborhood safety, school rating, and transit connectivity.">
          <div class="quick-action-icon text-cyan"><i class="fas fa-school"></i></div>
          <div class="quick-action-title">Location Intelligence</div>
          <div class="quick-action-desc">Schools, safety & transit LifeScores</div>
        </div>

        <div class="quick-action-card" data-prompt="Buy vs Rent: Explain the financial break-even and comparison.">
          <div class="quick-action-icon text-purple"><i class="fas fa-balance-scale"></i></div>
          <div class="quick-action-title">Buy vs Rent</div>
          <div class="quick-action-desc">Compare long-term financial outcomes</div>
        </div>
      </div>
    </div>
  `;
  setupInteractivePrompts();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
