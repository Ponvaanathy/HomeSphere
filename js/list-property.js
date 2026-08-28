/**
 * HomeSphere - List Property Controller
 * Complete Real Estate Marketplace Classification, Real Image File Upload & Automatic Backend Geocoding
 */

let currentStep = 1;
const totalSteps = 4;

// Step 1 Interactive Map & Location Pin State
let step1Map = null;
let step1Marker = null;
let currentSelectedLocation = {
  lat: 11.026700,
  lng: 77.002800,
  display_name: 'Peelamedu, Coimbatore, Tamil Nadu',
  locality: 'Peelamedu',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  isConfirmed: false
};

// Staged Image Files for Real Upload
let selectedImageFiles = [];
let primaryImageIndex = 0;

const CATEGORY_SUBTYPES = {
  'residential': [
    { value: 'apartment', label: 'Apartment' },
    { value: 'individual_home', label: 'Individual Home' },
    { value: 'villa', label: 'Villa' },
    { value: 'gated_community_home', label: 'Gated Community Home' },
    { value: 'duplex', label: 'Duplex' },
    { value: 'penthouse', label: 'Penthouse' },
    { value: 'studio_apartment', label: 'Studio Apartment' },
    { value: 'builder_floor', label: 'Builder Floor' },
    { value: 'row_house', label: 'Row House' },
    { value: 'farm_house', label: 'Farm House' }
  ],
  'land_plots': [
    { value: 'residential_plot', label: 'Residential Plot' },
    { value: 'agricultural_land', label: 'Agricultural Land' },
    { value: 'commercial_plot', label: 'Commercial Plot' },
    { value: 'farm_land', label: 'Farm Land' },
    { value: 'industrial_land', label: 'Industrial Land' }
  ],
  'commercial': [
    { value: 'office_space', label: 'Office Space' },
    { value: 'shop', label: 'Shop' },
    { value: 'showroom', label: 'Showroom' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'commercial_building', label: 'Commercial Building' },
    { value: 'coworking_space', label: 'Co-working Space' },
    { value: 'industrial_property', label: 'Industrial Property' }
  ],
  'pg_rooms': [
    { value: 'pg', label: 'PG' },
    { value: 'shared_room', label: 'Shared Room' },
    { value: 'private_room', label: 'Private Room' },
    { value: 'hostel', label: 'Hostel' },
    { value: 'co_living', label: 'Co-living' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndSyncNav();
  setupIntentRadioCards();
  setupCategoryAndSubtypes();
  setupRealImageUpload();
  setupStepButtons();
  setupStep1LocationMap();
  setupFormSubmit();
  setupListAnotherButton();
});

/**
 * 1. AUTHENTICATION CHECK & NAVBAR SYNC
 */
function checkAuthAndSyncNav() {
  const token = localStorage.getItem('homesphere_token');
  const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');

  if (!token || !user) {
    showToast('Please sign in to list a property.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html?redirect=/list-property.html';
    }, 1000);
    return;
  }

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
      <a href="/saved.html" class="btn btn-secondary btn-sm" title="Saved Properties"><i class="far fa-heart"></i> Saved</a>
      <a href="/dashboard.html" class="btn btn-primary btn-sm"><i class="fas fa-th-large"></i> Dashboard</a>
    `;
  }
}


/**
 * 2. INTENT RADIO TOGGLES (SALE / RENT / LEASE)
 */
function setupIntentRadioCards() {
  const radioCards = document.querySelectorAll('.custom-radio-card');
  const depositGroup = document.getElementById('depositGroup');
  const priceInputLabel = document.getElementById('priceInputLabel');
  const priceHelperText = document.getElementById('priceHelperText');

  radioCards.forEach(card => {
    card.addEventListener('click', () => {
      radioCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      const type = card.getAttribute('data-type');
      if (type === 'rent') {
        if (depositGroup) depositGroup.style.display = 'block';
        if (priceInputLabel) priceInputLabel.textContent = 'Monthly Rental Rate (₹ INR) *';
        if (priceHelperText) priceHelperText.textContent = 'Enter the monthly rent amount in Rupees.';
      } else if (type === 'lease') {
        if (depositGroup) depositGroup.style.display = 'block';
        if (priceInputLabel) priceInputLabel.textContent = 'Lease Consideration (₹ INR) *';
        if (priceHelperText) priceHelperText.textContent = 'Enter the total lease outlay in Rupees.';
      } else {
        if (depositGroup) depositGroup.style.display = 'none';
        if (priceInputLabel) priceInputLabel.textContent = 'Listing Sale Price (₹ INR) *';
        if (priceHelperText) priceHelperText.textContent = 'Enter the total sale price in Rupees.';
      }
    });
  });
}

/**
 * 3. CATEGORY & DYNAMIC SUBTYPES ARCHITECTURE
 */
function setupCategoryAndSubtypes() {
  const categorySelect = document.getElementById('propCategory');
  const subtypeSelect = document.getElementById('propSubtype');

  if (!categorySelect || !subtypeSelect) return;

  function populateSubtypes(categoryVal) {
    const list = CATEGORY_SUBTYPES[categoryVal] || CATEGORY_SUBTYPES['residential'];
    subtypeSelect.innerHTML = list.map(item => `<option value="${item.value}">${item.label}</option>`).join('');
    renderDynamicSubtypeFields(categoryVal, subtypeSelect.value);
  }

  // Initial population
  populateSubtypes(categorySelect.value);

  categorySelect.addEventListener('change', () => {
    populateSubtypes(categorySelect.value);
  });

  subtypeSelect.addEventListener('change', () => {
    renderDynamicSubtypeFields(categorySelect.value, subtypeSelect.value);
  });
}

/**
 * 4. DYNAMIC SUBTYPE-SPECIFIC FIELDS RENDERER
 */
function renderDynamicSubtypeFields(category, subtype) {
  const container = document.getElementById('dynamicSubtypeFieldsContainer');
  if (!container) return;

  let html = '';

  // 1. Gated Community Home
  if (subtype === 'gated_community_home') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-city"></i> Gated Residential Development / Community Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Community / Project Name *</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. CasaGrand XYZ / Purva Windermere" required>
            <span class="text-muted" style="font-size:0.72rem;">Allows multiple homes to be indexed under the same residential development.</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="propCommunityType">Community Type</label>
            <select id="propCommunityType" class="form-select">
              <option value="Villa Community" selected>Villa Community</option>
              <option value="Row House Community">Row House Community</option>
              <option value="Apartment Community">Apartment Community</option>
              <option value="Mixed Residential Community">Mixed Residential Community</option>
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Unit / House / Villa Number (Optional)</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Villa 12 / Plot B-4">
          </div>
          <div class="form-group">
            <label class="form-label" for="propPlotArea">Plot / Land Area (Sq.Ft)</label>
            <input type="number" id="propPlotArea" class="form-input" placeholder="e.g. 2400" min="0">
          </div>
        </div>
      </div>
    `;
  }

  // 2. Apartment / Flat
  else if (subtype === 'apartment' || subtype === 'studio_apartment' || subtype === 'builder_floor') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-building"></i> Apartment & Tower Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Apartment / Project Name (Optional)</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. Prestige Greenwoods / Skyline Towers">
          </div>
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Flat / Unit Number (Optional)</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Flat 402 / Tower 3">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propFloorNumber">Floor Number</label>
            <input type="number" id="propFloorNumber" class="form-input" placeholder="e.g. 4" min="0">
          </div>
          <div class="form-group">
            <label class="form-label" for="propTotalFloors">Total Floors in Building</label>
            <input type="number" id="propTotalFloors" class="form-input" placeholder="e.g. 14" min="1">
          </div>
        </div>
      </div>
    `;
  }

  // 3. Individual Home / Standalone House
  else if (subtype === 'individual_home' || subtype === 'farm_house' || subtype === 'row_house') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-home"></i> Individual Home & Plot Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propPlotArea">Plot / Site Area (Sq.Ft)</label>
            <input type="number" id="propPlotArea" class="form-input" placeholder="e.g. 2100" min="0">
          </div>
          <div class="form-group">
            <label class="form-label" for="propTotalFloors">Total Floors / Stories</label>
            <input type="number" id="propTotalFloors" class="form-input" placeholder="e.g. 2 (G+1)" value="2" min="1">
          </div>
        </div>
      </div>
    `;
  }

  // 4. Villa
  else if (subtype === 'villa') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-crown"></i> Luxury Villa Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Villa Community / Project Name (Optional)</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. Royal Palms Estate">
          </div>
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Villa / Unit Number (Optional)</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Villa 7">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propPlotArea">Plot Area (Sq.Ft)</label>
            <input type="number" id="propPlotArea" class="form-input" placeholder="e.g. 3200" min="0">
          </div>
          <div class="form-group">
            <label class="form-label" for="propTotalFloors">Villa Stories</label>
            <input type="number" id="propTotalFloors" class="form-input" placeholder="e.g. 2" value="2" min="1">
          </div>
        </div>
      </div>
    `;
  }

  // 5. Duplex & Penthouse
  else if (subtype === 'duplex' || subtype === 'penthouse') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-gem"></i> ${subtype === 'penthouse' ? 'Penthouse & Skyline' : 'Duplex'} Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Project / Building Name</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. Pinnacle Heights">
          </div>
          <div class="form-group">
            <label class="form-label" for="propFloorNumber">Floor Level</label>
            <input type="number" id="propFloorNumber" class="form-input" placeholder="e.g. 18 (Top Floor)" min="1">
          </div>
        </div>
        ${subtype === 'penthouse' ? `
          <div class="form-group">
            <label class="form-label" for="propTerraceArea">Private Terrace Area (Sq.Ft)</label>
            <input type="number" id="propTerraceArea" class="form-input" placeholder="e.g. 800" min="0">
          </div>
        ` : ''}
      </div>
    `;
  }

  // 6. Land / Plots
  else if (category === 'land_plots') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-map"></i> Land & Plot Layout Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Layout / Project Name (Optional)</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. Green Meadows Layout">
          </div>
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Plot / Survey Number (Optional)</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Plot No 45">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propFacingDirection">Facing Direction</label>
            <select id="propFacingDirection" class="form-select">
              <option value="North" selected>North Facing</option>
              <option value="East">East Facing</option>
              <option value="South">South Facing</option>
              <option value="West">West Facing</option>
              <option value="North-East">North-East Corner</option>
              <option value="North-West">North-West Corner</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="propPlotArea">Plot Dimension / Area (Sq.Ft)</label>
            <input type="number" id="propPlotArea" class="form-input" placeholder="e.g. 2400" min="100">
          </div>
        </div>
      </div>
    `;
  }

  // 7. Commercial
  else if (category === 'commercial') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-briefcase"></i> Commercial Complex Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">Commercial Complex / Tech Park Name</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. TIDEL Park Tech Zone">
          </div>
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Unit / Suite Number</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Suite 305">
          </div>
        </div>
      </div>
    `;
  }

  // 8. PG / Rooms
  else if (category === 'pg_rooms') {
    html = `
      <div class="dynamic-fields-card">
        <div class="dynamic-fields-header">
          <i class="fas fa-bed"></i> PG / Co-Living Specifications
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="propProjectName">PG / Property Name</label>
            <input type="text" id="propProjectName" class="form-input" placeholder="e.g. Stanza Living / Zolo Stay">
          </div>
          <div class="form-group">
            <label class="form-label" for="propUnitNumber">Room / Bed No</label>
            <input type="text" id="propUnitNumber" class="form-input" placeholder="e.g. Room 204">
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * 5. REAL PROPERTY IMAGES UPLOAD, VALIDATION & PREVIEWS
 */
function setupRealImageUpload() {
  const dropzone = document.getElementById('imageUploadDropzone');
  const fileInput = document.getElementById('propImageFileInput');
  const addMoreBtn = document.getElementById('btnAddMorePhotos');

  if (!dropzone || !fileInput) return;

  // Click dropzone to open file dialog
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  // File Input Changed
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
      fileInput.value = ''; // Reset so the same file can be re-selected if removed
    }
  });

  // Drag and Drop Events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFilesSelected(Array.from(dt.files));
    }
  });
}

function handleFilesSelected(files) {
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/pjpeg', 'image/x-png', 'image/jpg'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  let addedCount = 0;

  files.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const isMimeValid = allowedMimeTypes.includes(file.type.toLowerCase()) || allowedExtensions.includes(ext);

    if (!isMimeValid || !allowedExtensions.includes(ext)) {
      showToast(`Unsupported image format: "${file.name}". Only JPG, JPEG, PNG, and WEBP are allowed.`, 'error');
      return;
    }

    if (file.size > maxSizeBytes) {
      showToast(`Image size is too large: "${file.name}". Maximum size is 10MB.`, 'error');
      return;
    }

    // Check for duplicate name + size in current selection
    const isDuplicate = selectedImageFiles.some(f => f.name === file.name && f.size === file.size);
    if (!isDuplicate) {
      if (selectedImageFiles.length < 20) {
        selectedImageFiles.push(file);
        addedCount++;
      } else {
        showToast('Maximum of 20 property images reached.', 'info');
      }
    }
  });

  if (addedCount > 0) {
    showToast(`Added ${addedCount} photo${addedCount > 1 ? 's' : ''}.`, 'success');
  }

  renderImagePreviews();
}

function renderImagePreviews() {
  const previewSection = document.getElementById('imagePreviewSection');
  const previewGrid = document.getElementById('imagePreviewGrid');
  const countBadge = document.getElementById('imageCountBadge');

  if (!previewSection || !previewGrid) return;

  if (selectedImageFiles.length === 0) {
    previewSection.style.display = 'none';
    previewGrid.innerHTML = '';
    primaryImageIndex = 0;
    return;
  }

  previewSection.style.display = 'block';
  if (countBadge) {
    countBadge.textContent = `Attached Photos (${selectedImageFiles.length})`;
  }

  // Ensure primary index is in range
  if (primaryImageIndex >= selectedImageFiles.length || primaryImageIndex < 0) {
    primaryImageIndex = 0;
  }

  previewGrid.innerHTML = selectedImageFiles.map((file, idx) => {
    const isCover = (idx === primaryImageIndex);
    const objectUrl = URL.createObjectURL(file);
    const formattedSize = file.size >= 1048576 
      ? `${(file.size / 1048576).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    return `
      <div class="preview-thumb-card ${isCover ? 'is-cover' : ''}" id="thumbCard-${idx}">
        <div class="thumb-image-wrapper" onclick="setPrimaryImageIndex(${idx})" title="${isCover ? 'Current Main Cover Photo' : 'Click to make Cover Photo'}">
          <img src="${objectUrl}" alt="${escapeHtml(file.name)}">
          ${isCover ? `
            <div class="badge-cover-indicator">
              <i class="fas fa-star"></i> Main Cover
            </div>
          ` : ''}
          <button type="button" class="btn-remove-thumb" onclick="removeImageFile(${idx}, event)" title="Remove Photo">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="thumb-details-footer">
          <div class="thumb-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="thumb-meta-row">
            <span>${formattedSize}</span>
            ${!isCover ? `
              <button type="button" class="btn-set-cover-action" onclick="setPrimaryImageIndex(${idx})">Set as Cover</button>
            ` : '<span style="color:#059669;font-weight:700;font-size:0.68rem;">✓ Cover</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setPrimaryImageIndex(idx) {
  if (idx >= 0 && idx < selectedImageFiles.length) {
    primaryImageIndex = idx;
    renderImagePreviews();
    showToast(`Set "${selectedImageFiles[idx].name}" as the Main Cover Photo.`, 'info');
  }
}

function removeImageFile(idx, e) {
  if (e) e.stopPropagation();
  if (idx >= 0 && idx < selectedImageFiles.length) {
    const removedFile = selectedImageFiles.splice(idx, 1)[0];
    if (primaryImageIndex >= selectedImageFiles.length) {
      primaryImageIndex = Math.max(0, selectedImageFiles.length - 1);
    } else if (idx < primaryImageIndex) {
      primaryImageIndex--;
    }
    renderImagePreviews();
    showToast(`Removed "${removedFile.name}".`, 'info');
  }
}

/**
 * 6. STEP NAVIGATION & VALIDATION
 */
function setupStepButtons() {
  const nextBtn = document.getElementById('nextStepBtn');
  const prevBtn = document.getElementById('prevStepBtn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        goToStep(currentStep + 1);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToStep(currentStep - 1);
    });
  }
}

function goToStep(step) {
  if (step < 1 || step > totalSteps) return;
  currentStep = step;

  // Update step indicators
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById(`stepIndicator${i}`);
    const panel = document.getElementById(`stepPanel${i}`);

    if (indicator) {
      indicator.classList.remove('active', 'completed');
      if (i === currentStep) {
        indicator.classList.add('active');
      } else if (i < currentStep) {
        indicator.classList.add('completed');
      }
    }

    if (panel) {
      panel.classList.toggle('active', i === currentStep);
    }
  }

  // Update buttons
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const submitBtn = document.getElementById('submitPropertyBtn');

  if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
  if (nextBtn) nextBtn.style.display = currentStep === totalSteps ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = currentStep === totalSteps ? 'inline-flex' : 'none';

  if (currentStep === 1 && typeof step1Map !== 'undefined' && step1Map) {
    setTimeout(() => {
      step1Map.invalidateSize();
    }, 200);
  }

  if (currentStep === totalSteps) {
    populateReviewSummary();
  }

  window.scrollTo({ top: 180, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const title = document.getElementById('propTitle')?.value.trim();
    const locality = document.getElementById('propLocality')?.value.trim();
    const city = document.getElementById('propCity')?.value.trim();
    const state = document.getElementById('propState')?.value.trim();
    const address = document.getElementById('propAddress')?.value.trim();

    if (!title) {
      showToast('Please enter a descriptive property title.', 'error');
      document.getElementById('propTitle')?.focus();
      return false;
    }
    if (!locality) {
      showToast('Please type the locality / neighborhood name.', 'error');
      document.getElementById('propLocality')?.focus();
      return false;
    }
    if (!city || !state) {
      showToast('City and state are required.', 'error');
      return false;
    }
    if (!address) {
      showToast('Please type the full property street address.', 'error');
      document.getElementById('propAddress')?.focus();
      return false;
    }
  } else if (step === 2) {
    const priceStr = document.getElementById('propPrice')?.value;
    const areaStr = document.getElementById('propArea')?.value;
    const price = parseFloat(priceStr);
    const area = parseInt(areaStr);

    if (!priceStr || isNaN(price) || price <= 0) {
      showToast('Please enter a valid listing price greater than 0.', 'error');
      document.getElementById('propPrice')?.focus();
      return false;
    }
    if (!areaStr || isNaN(area) || area <= 0) {
      showToast('Please enter a valid built-up area in square feet.', 'error');
      document.getElementById('propArea')?.focus();
      return false;
    }
  }
  return true;
}

function populateReviewSummary() {
  const title = document.getElementById('propTitle')?.value.trim() || 'Property Listing';
  const checkedRadio = document.querySelector('input[name="listingIntent"]:checked');
  const type = checkedRadio ? checkedRadio.value : 'sale';
  const category = document.getElementById('propCategory')?.value || 'residential';
  const subtype = document.getElementById('propSubtype')?.value || 'apartment';
  const price = parseFloat(document.getElementById('propPrice')?.value) || 0;
  const locality = document.getElementById('propLocality')?.value.trim() || 'Peelamedu';
  const city = document.getElementById('propCity')?.value.trim() || 'Coimbatore';
  const projectName = document.getElementById('propProjectName')?.value.trim() || '';
  const unitNumber = document.getElementById('propUnitNumber')?.value.trim() || '';
  const beds = document.getElementById('propBeds')?.value || '3';
  const baths = document.getElementById('propBaths')?.value || '3';
  const area = document.getElementById('propArea')?.value || '1850';

  const reviewTitleEl = document.getElementById('reviewTitle');
  const reviewPriceEl = document.getElementById('reviewPrice');
  const reviewClassEl = document.getElementById('reviewClassification');
  const reviewProjectBox = document.getElementById('reviewProjectCommunity');
  const reviewProjectText = document.getElementById('reviewProjectText');
  const reviewLocEl = document.getElementById('reviewLocation');
  const reviewSpecsEl = document.getElementById('reviewSpecs');
  const reviewPhotoCountLabel = document.getElementById('reviewPhotoCountLabel');
  const reviewGalleryRow = document.getElementById('reviewGalleryRow');

  if (reviewTitleEl) reviewTitleEl.textContent = title;
  if (reviewPriceEl) reviewPriceEl.innerHTML = formatPrice(price, type);

  const formattedCategory = category.toUpperCase().replace(/_/g, ' ');
  const formattedSubtype = subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (reviewClassEl) reviewClassEl.textContent = `${formattedCategory} • ${formattedSubtype}`;

  if (projectName || unitNumber) {
    if (reviewProjectBox) reviewProjectBox.style.display = 'flex';
    if (reviewProjectText) reviewProjectText.textContent = `${projectName}${unitNumber ? ' (Unit: ' + unitNumber + ')' : ''}`;
  } else {
    if (reviewProjectBox) reviewProjectBox.style.display = 'none';
  }

  if (reviewLocEl) reviewLocEl.innerHTML = `<i class="fas fa-map-marker-alt text-rose"></i> <span>${escapeHtml(locality)}, ${escapeHtml(city)}</span>`;

  if (reviewSpecsEl) {
    reviewSpecsEl.innerHTML = `
      <span><i class="fas fa-bed text-brand"></i> ${beds} Beds</span>
      <span>•</span>
      <span><i class="fas fa-bath text-brand"></i> ${baths} Baths</span>
      <span>•</span>
      <span><i class="fas fa-vector-square text-brand"></i> ${Number(area).toLocaleString()} sqft</span>
    `;
  }

  // Render Review Gallery
  if (reviewPhotoCountLabel) {
    reviewPhotoCountLabel.textContent = `Attached Photos (${selectedImageFiles.length})`;
  }
  if (reviewGalleryRow) {
    if (selectedImageFiles.length > 0) {
      reviewGalleryRow.innerHTML = selectedImageFiles.map((file, idx) => {
        const isCover = (idx === primaryImageIndex);
        const objUrl = URL.createObjectURL(file);
        return `
          <div style="position: relative; flex-shrink: 0;">
            <img src="${objUrl}" class="review-thumb-item" alt="Photo ${idx + 1}" style="${isCover ? 'border: 2px solid #059669;' : ''}">
            ${isCover ? '<span style="position: absolute; bottom: 4px; left: 4px; background: #059669; color: #fff; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; font-weight: 800;">COVER</span>' : ''}
          </div>
        `;
      }).join('');
    } else {
      reviewGalleryRow.innerHTML = `<span class="text-muted" style="font-size: 0.8rem; font-style: italic;">No custom photos uploaded. A verified default cover image will be assigned.</span>`;
    }
  }
}

/**
 * 7. FORM SUBMISSION WITH MULTIPART FORMDATA (FILES + FIELDS)
 */
function setupFormSubmit() {
  const form = document.getElementById('listPropertyForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPropertyListing();
  });
}

async function submitPropertyListing() {
  const token = localStorage.getItem('homesphere_token');
  const submitBtn = document.getElementById('submitPropertyBtn');

  if (!token) {
    showToast('Your session has expired. Please sign in.', 'error');
    setTimeout(() => { window.location.href = '/login.html'; }, 1200);
    return;
  }

  // Extract form fields
  const title = document.getElementById('propTitle')?.value.trim();
  const checkedRadio = document.querySelector('input[name="listingIntent"]:checked');
  const type = checkedRadio ? checkedRadio.value : 'sale';
  const category = document.getElementById('propCategory')?.value || 'residential';
  const subcategory = document.getElementById('propSubtype')?.value || 'apartment';
  const property_subtype = subcategory;
  const property_type = subcategory;

  const project_name = document.getElementById('propProjectName')?.value.trim() || '';
  const community_name = project_name;
  const community_type = document.getElementById('propCommunityType')?.value || '';
  const unit_number = document.getElementById('propUnitNumber')?.value.trim() || '';

  const locality = document.getElementById('propLocality')?.value.trim() || 'Peelamedu';
  const city = document.getElementById('propCity')?.value.trim() || 'Coimbatore';
  const state = document.getElementById('propState')?.value.trim() || 'Tamil Nadu';
  const zip_code = document.getElementById('propZip')?.value.trim() || '641004';
  const address = document.getElementById('propAddress')?.value.trim();
  const description = document.getElementById('propDescription')?.value.trim() || `Verified ${subcategory.replace(/_/g, ' ')} in ${locality}, ${city}.`;

  const price = document.getElementById('propPrice')?.value;
  const deposit = document.getElementById('propDeposit')?.value || '0';
  const bedrooms = document.getElementById('propBeds')?.value || '1';
  const bathrooms = document.getElementById('propBaths')?.value || '1';
  const bhk = bedrooms;
  const area_sqft = document.getElementById('propArea')?.value;
  const plot_area_sqft = document.getElementById('propPlotArea')?.value || '';
  const floor_number = document.getElementById('propFloorNumber')?.value || '';
  const total_floors = document.getElementById('propTotalFloors')?.value || '';
  const terrace_area_sqft = document.getElementById('propTerraceArea')?.value || '';
  const facing_direction = document.getElementById('propFacingDirection')?.value || '';

  const year_built = document.getElementById('propYearBuilt')?.value || '2023';
  const furnishing = document.getElementById('propFurnishing')?.value || 'unfurnished';
  const legal_status = document.getElementById('propLegalStatus')?.value || '100% Clear Freehold Title Verified';

  // Optional Cost Overrides
  const monthly_maintenance = document.getElementById('propMonthlyMaintenance')?.value.trim() || '';
  const fitout_budget = document.getElementById('propFitoutBudget')?.value.trim() || '';
  const other_costs = document.getElementById('propOtherCosts')?.value.trim() || '';

  // Gather selected amenities
  const checkedAmenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value);

  // Construct Multipart FormData
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('type', type);
  formData.append('category', category);
  formData.append('subcategory', subcategory);
  formData.append('property_subtype', property_subtype);
  formData.append('property_type', property_type);
  formData.append('project_name', project_name);
  formData.append('community_name', community_name);
  formData.append('community_type', community_type);
  formData.append('unit_number', unit_number);
  formData.append('price', price);
  formData.append('deposit', deposit);
  formData.append('currency', 'INR');
  formData.append('lease_term', type === 'rent' ? '12 months' : 'N/A');
  formData.append('address', address);
  formData.append('locality', locality);
  formData.append('city', city);
  formData.append('state', state);
  formData.append('zip_code', zip_code);

  // Append Auto-Geocoded GPS Coordinates from Interactive Map Pin
  const finalLat = (currentSelectedLocation && !isNaN(currentSelectedLocation.lat)) ? currentSelectedLocation.lat : (parseFloat(document.getElementById('propLat')?.value) || 11.0267);
  const finalLng = (currentSelectedLocation && !isNaN(currentSelectedLocation.lng)) ? currentSelectedLocation.lng : (parseFloat(document.getElementById('propLng')?.value) || 77.0028);
  formData.append('lat', finalLat);
  formData.append('lng', finalLng);
  formData.append('latitude', finalLat);
  formData.append('longitude', finalLng);

  formData.append('bedrooms', bedrooms);
  formData.append('bathrooms', bathrooms);
  formData.append('bhk', bhk);
  formData.append('area_sqft', area_sqft);
  if (plot_area_sqft) formData.append('plot_area_sqft', plot_area_sqft);
  if (floor_number) formData.append('floor_number', floor_number);
  if (total_floors) formData.append('total_floors', total_floors);
  if (terrace_area_sqft) formData.append('terrace_area_sqft', terrace_area_sqft);
  if (facing_direction) formData.append('facing_direction', facing_direction);
  formData.append('year_built', year_built);
  formData.append('furnishing', furnishing);
  formData.append('parking_spaces', parking_spaces);
  formData.append('legal_status', legal_status);
  if (monthly_maintenance) formData.append('monthly_maintenance', monthly_maintenance);
  if (fitout_budget) formData.append('fitout_budget', fitout_budget);
  if (other_costs) formData.append('other_costs', other_costs);
  formData.append('amenities_json', JSON.stringify(checkedAmenities));
  formData.append('primary_image_index', primaryImageIndex);



  // Append Real Image Files
  selectedImageFiles.forEach(file => {
    formData.append('images', file);
  });

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading Images & Geocoding...';
  }

  try {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Note: Do NOT set Content-Type header when using FormData; the browser sets boundary automatically
      },
      body: formData
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      if (res.status === 401 || result.sessionInvalid) {
        localStorage.removeItem('homesphere_token');
        localStorage.removeItem('homesphere_user');
        showToast('Your session has expired. Please sign in again.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
      }
      throw new Error(result.message || 'Failed to list property.');
    }

    const createdPropId = result.data.property_id || result.data.id;
    const coverImgUrl = result.data.primary_image || (result.data.images && result.data.images[0]?.image_url);

    // Show Success State
    showToast('🎉 Property and photos uploaded successfully!', 'success');
    renderSuccessScreen(createdPropId, title, parseFloat(price), type, category, subcategory, project_name, unit_number, locality, city, coverImgUrl);
  } catch (err) {
    showToast(err.message || 'Unable to list property. Please try again.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Publish Listing & Synthesize Intelligence';
    }
  }
}

/**
 * 8. RENDER SUCCESS SCREEN
 */
function renderSuccessScreen(propertyId, title, price, type, category, subcategory, project_name, unit_number, locality, city, coverImgUrl) {
  const wizardCard = document.getElementById('wizardFormCard');
  const successPanel = document.getElementById('successPanel');
  const successIdBadge = document.getElementById('successPropIdBadge');
  const successTitle = document.getElementById('successPropTitle');
  const successClassBadge = document.getElementById('successClassificationBadge');
  const successPrice = document.getElementById('successPropPrice');
  const successLoc = document.getElementById('successPropLoc');
  const btnViewDetails = document.getElementById('successBtnViewDetails');

  if (wizardCard) wizardCard.style.display = 'none';
  if (successPanel) successPanel.style.display = 'block';

  if (successIdBadge) successIdBadge.textContent = `Property #${propertyId}`;
  if (successTitle) successTitle.textContent = title;

  const formattedCategory = (category || 'residential').toUpperCase().replace(/_/g, ' ');
  const formattedSubtype = (subcategory || 'apartment').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let classText = `${formattedCategory} • ${formattedSubtype}`;
  if (project_name) classText += ` [${project_name}${unit_number ? ' • ' + unit_number : ''}]`;
  if (successClassBadge) successClassBadge.textContent = classText;

  if (successPrice) successPrice.innerHTML = formatPrice(price, type);
  if (successLoc) {
    let locHtml = `<i class="fas fa-map-marker-alt text-rose"></i> <span>${escapeHtml(locality)}, ${escapeHtml(city)}</span>`;
    if (coverImgUrl) {
      locHtml += `
        <div style="margin-top: 0.75rem; border-radius: 8px; overflow: hidden; height: 160px; max-width: 280px; margin-left: auto; margin-right: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <img src="${coverImgUrl}" alt="Cover Photo" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `;
    }
    successLoc.innerHTML = locHtml;
  }
  if (btnViewDetails) btnViewDetails.href = `/property-details.html?id=${propertyId}`;

  window.scrollTo({ top: 150, behavior: 'smooth' });
}

/**
 * 9. "LIST ANOTHER PROPERTY" RESET BUTTON
 */
function setupListAnotherButton() {
  const btnListAnother = document.getElementById('btnListAnother');
  if (!btnListAnother) return;

  btnListAnother.addEventListener('click', () => {
    const wizardCard = document.getElementById('wizardFormCard');
    const successPanel = document.getElementById('successPanel');
    const form = document.getElementById('listPropertyForm');

    if (form) form.reset();
    selectedImageFiles = [];
    primaryImageIndex = 0;
    renderImagePreviews();

    if (wizardCard) wizardCard.style.display = 'block';
    if (successPanel) successPanel.style.display = 'none';

    // Reset default location
    currentSelectedLocation = {
      lat: 11.026700,
      lng: 77.002800,
      display_name: 'Peelamedu, Coimbatore, Tamil Nadu',
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      isConfirmed: false
    };

    const latInput = document.getElementById('propLat');
    const lngInput = document.getElementById('propLng');
    if (latInput) latInput.value = '11.0267';
    if (lngInput) lngInput.value = '77.0028';

    const confirmedBadge = document.getElementById('locationConfirmedBadge');
    if (confirmedBadge) confirmedBadge.style.display = 'none';

    if (step1Marker) {
      step1Marker.setLatLng([11.0267, 77.0028]);
      updateMarkerPopup('📍 Property Location', 'Peelamedu, Coimbatore, Tamil Nadu');
    }
    if (step1Map) {
      step1Map.setView([11.0267, 77.0028], 14);
    }

    setupCategoryAndSubtypes();
    goToStep(1);
  });
}

/**
 * 10. STEP 1 INTERACTIVE MAP & PIN CONTROLLER
 */
function setupStep1LocationMap() {
  const mapContainer = document.getElementById('step1MapContainer');
  if (!mapContainer) return;

  if (typeof L === 'undefined') {
    setTimeout(setupStep1LocationMap, 250);
    return;
  }

  try {
    if (step1Map) {
      step1Map.remove();
      step1Map = null;
    }

    step1Map = L.map('step1MapContainer', {
      center: [currentSelectedLocation.lat, currentSelectedLocation.lng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | HomeSphere',
      maxZoom: 19
    }).addTo(step1Map);

    const pinIcon = L.divIcon({
      className: 'step1-property-pin-wrapper',
      html: `
        <div style="width: 38px; height: 38px; border-radius: 50% 50% 50% 0; background: #2563eb; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37,99,235,0.45); border: 2.5px solid #ffffff; cursor: grab;">
          <i class="fas fa-home" style="transform: rotate(45deg); color: #ffffff; font-size: 0.95rem;"></i>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38]
    });

    step1Marker = L.marker([currentSelectedLocation.lat, currentSelectedLocation.lng], {
      icon: pinIcon,
      draggable: true
    }).addTo(step1Map);

    updateMarkerPopup('📍 Property Location', currentSelectedLocation.display_name);

    // Marker Dragend Event
    step1Marker.on('dragend', async () => {
      const pos = step1Marker.getLatLng();
      await handlePinMoved(pos.lat, pos.lng);
    });

    // Map Click Event
    step1Map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      step1Marker.setLatLng([lat, lng]);
      await handlePinMoved(lat, lng);
    });

    setTimeout(() => {
      if (step1Map) step1Map.invalidateSize();
    }, 300);

  } catch (err) {
    console.error('Error initializing Step 1 map:', err);
  }

  // Location Search Bar Listeners
  const searchInput = document.getElementById('propLocationSearch');
  const btnSearch = document.getElementById('btnSearchLocation');

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      clearTimeout(debounceTimer);
      if (val.length >= 3) {
        debounceTimer = setTimeout(() => {
          geocodeAndMoveMap(val, false);
        }, 550);
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = searchInput.value.trim();
        if (val) {
          clearTimeout(debounceTimer);
          geocodeAndMoveMap(val, true);
        }
      }
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      const val = searchInput ? searchInput.value.trim() : '';
      if (val) {
        clearTimeout(debounceTimer);
        geocodeAndMoveMap(val, true);
      }
    });
  }

  // Quick Location Recommendation Chips
  const chipBtns = document.querySelectorAll('.location-chip-btn');
  chipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      const loc = chip.getAttribute('data-loc');
      if (loc) {
        if (searchInput) searchInput.value = loc;
        geocodeAndMoveMap(loc, true);
      }
    });
  });

  // [ Confirm Location ] Button
  const btnConfirm = document.getElementById('btnConfirmLocation');
  const confirmedBadge = document.getElementById('locationConfirmedBadge');

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      currentSelectedLocation.isConfirmed = true;
      if (confirmedBadge) confirmedBadge.style.display = 'inline-flex';
      showToast(`✅ Location confirmed: ${currentSelectedLocation.locality || currentSelectedLocation.display_name}`, 'success');
      updateMarkerPopup('✅ Verified Property Location', currentSelectedLocation.display_name);
    });
  }

  // Address inputs blur listener to sync with map
  const localityInput = document.getElementById('propLocality');
  const addressInput = document.getElementById('propAddress');

  [localityInput, addressInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('blur', () => {
      const locVal = localityInput ? localityInput.value.trim() : '';
      const cityVal = document.getElementById('propCity')?.value.trim() || 'Coimbatore';
      if (locVal && !currentSelectedLocation.isConfirmed) {
        const fullQ = `${locVal}, ${cityVal}`;
        geocodeAndMoveMap(fullQ, false);
      }
    });
  });
}

/**
 * Handle Marker Drag / Map Click
 */
async function handlePinMoved(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  currentSelectedLocation.lat = numLat;
  currentSelectedLocation.lng = numLng;
  currentSelectedLocation.isConfirmed = false;

  const confirmedBadge = document.getElementById('locationConfirmedBadge');
  if (confirmedBadge) confirmedBadge.style.display = 'none';

  // Update hidden inputs
  const latInput = document.getElementById('propLat');
  const lngInput = document.getElementById('propLng');
  if (latInput) latInput.value = numLat.toFixed(6);
  if (lngInput) lngInput.value = numLng.toFixed(6);

  const locText = document.getElementById('mapSelectedLocationText');
  if (locText) locText.innerHTML = `<i class="fas fa-spinner fa-spin text-brand"></i> Resolving address...`;

  try {
    const res = await fetch(`/api/search/reverse-geocode?lat=${numLat}&lng=${numLng}`);
    const data = await res.json();

    if (data && data.success && data.display_name) {
      currentSelectedLocation.display_name = data.display_name;
      currentSelectedLocation.locality = data.locality || currentSelectedLocation.locality;
      currentSelectedLocation.city = data.city || currentSelectedLocation.city;
      currentSelectedLocation.state = data.state || currentSelectedLocation.state;

      if (locText) locText.textContent = data.display_name;

      const searchInput = document.getElementById('propLocationSearch');
      if (searchInput && document.activeElement !== searchInput) {
        searchInput.value = data.display_name;
      }
      const localityInput = document.getElementById('propLocality');
      if (localityInput && data.locality) localityInput.value = data.locality;
      const cityInput = document.getElementById('propCity');
      if (cityInput && data.city) cityInput.value = data.city;
      const stateInput = document.getElementById('propState');
      if (stateInput && data.state) stateInput.value = data.state;

      updateMarkerPopup('📍 Property Location', data.display_name);
    } else {
      const fallbackName = `Location (${numLat.toFixed(4)}, ${numLng.toFixed(4)})`;
      currentSelectedLocation.display_name = fallbackName;
      if (locText) locText.textContent = fallbackName;
      updateMarkerPopup('📍 Property Location', fallbackName);
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    const fallbackName = `Location (${numLat.toFixed(4)}, ${numLng.toFixed(4)})`;
    if (locText) locText.textContent = fallbackName;
  }
}

/**
 * Forward Geocode Address & Pan Map
 */
async function geocodeAndMoveMap(queryText, isExplicit = false) {
  if (!queryText || queryText.trim().length < 2) return;
  const cleanQ = queryText.trim();

  const alertBox = document.getElementById('mapGeocodeAlert');
  const alertText = document.getElementById('mapGeocodeAlertText');
  const locText = document.getElementById('mapSelectedLocationText');
  const confirmedBadge = document.getElementById('locationConfirmedBadge');

  if (alertBox) alertBox.style.display = 'none';
  if (locText) locText.innerHTML = `<i class="fas fa-spinner fa-spin text-brand"></i> Locating "${escapeHtml(cleanQ)}"...`;

  try {
    const res = await fetch(`/api/search/geocode?q=${encodeURIComponent(cleanQ)}`);
    const data = await res.json();

    if (data && data.success && data.lat && data.lng) {
      currentSelectedLocation.lat = parseFloat(data.lat);
      currentSelectedLocation.lng = parseFloat(data.lng);
      currentSelectedLocation.display_name = data.display_name || cleanQ;
      currentSelectedLocation.locality = data.locality || cleanQ.split(',')[0].trim();
      currentSelectedLocation.city = data.city || 'Coimbatore';
      currentSelectedLocation.state = data.state || 'Tamil Nadu';
      currentSelectedLocation.isConfirmed = false;

      if (confirmedBadge) confirmedBadge.style.display = 'none';

      // Update hidden inputs
      const latInput = document.getElementById('propLat');
      const lngInput = document.getElementById('propLng');
      if (latInput) latInput.value = currentSelectedLocation.lat.toFixed(6);
      if (lngInput) lngInput.value = currentSelectedLocation.lng.toFixed(6);

      if (locText) locText.textContent = currentSelectedLocation.display_name;

      // Update address fields
      const localityInput = document.getElementById('propLocality');
      if (localityInput && currentSelectedLocation.locality) localityInput.value = currentSelectedLocation.locality;
      const cityInput = document.getElementById('propCity');
      if (cityInput && currentSelectedLocation.city) cityInput.value = currentSelectedLocation.city;
      const stateInput = document.getElementById('propState');
      if (stateInput && currentSelectedLocation.state) stateInput.value = currentSelectedLocation.state;

      // Move marker & map
      if (step1Marker) {
        step1Marker.setLatLng([currentSelectedLocation.lat, currentSelectedLocation.lng]);
        updateMarkerPopup('📍 Property Location', currentSelectedLocation.display_name);
      }
      if (step1Map) {
        step1Map.flyTo([currentSelectedLocation.lat, currentSelectedLocation.lng], 15, { duration: 1.0 });
      }

      if (isExplicit) {
        showToast(`📍 Found location: ${currentSelectedLocation.locality}`, 'info');
      }
    } else {
      if (alertBox && alertText) {
        alertText.textContent = 'Location not found. Please search for a more specific location.';
        alertBox.style.display = 'flex';
      }
      if (locText) locText.textContent = cleanQ;
    }
  } catch (err) {
    console.warn('Geocoding error:', err);
    if (alertBox && alertText) {
      alertText.textContent = 'Location not found. Please search for a more specific location.';
      alertBox.style.display = 'flex';
    }
    if (locText) locText.textContent = cleanQ;
  }
}

function updateMarkerPopup(title, address) {
  if (!step1Marker) return;
  const popupHtml = `
    <div style="font-family: inherit; font-size: 0.85rem;">
      <strong style="color: #1e293b; display: block; margin-bottom: 2px;">${escapeHtml(title)}</strong>
      <span style="color: #64748b; font-size: 0.78rem;">${escapeHtml(address)}</span>
    </div>
  `;
  step1Marker.bindPopup(popupHtml).openPopup();
}

/**
 * 11. UTILITIES
 */
function formatPrice(price, type) {
  if (!price || isNaN(price)) return '₹0';
  const priceNum = Number(price);

  let formatted = '';
  if (priceNum >= 10000000) {
    formatted = `₹${(priceNum / 10000000).toFixed(2)} Cr`;
  } else if (priceNum >= 100000) {
    formatted = `₹${(priceNum / 100000).toFixed(2)} Lakhs`;
  } else {
    formatted = `₹${priceNum.toLocaleString('en-IN')}`;
  }

  if (type === 'rent' || type === 'lease') {
    formatted += '<span style="font-size: 0.75em; font-weight: normal; color: var(--text-muted);">/mo</span>';
  }
  return formatted;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.1rem;margin-left:auto;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}