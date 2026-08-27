// HomeSphere Multi-Step Property Listing Logic with Real Uploads & Virtual Tour Builder

let currentStep = 1;
const totalSteps = 4;

// Selected Gallery Images state
let selectedGalleryFiles = []; // Array of File objects
let primaryGalleryIndex = 0;

// Virtual Tour Rooms state
let virtualTourRooms = []; // Array of { id, name, description, file, is_panoramic, previewUrl }
let roomCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('homesphere_token');
  const user = JSON.parse(localStorage.getItem('homesphere_user') || 'null');

  if (!token || !user) {
    showToast('Please log in to list a property.', 'info');
    setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    return;
  }

  // Intent Toggle (Buy vs Rent changes labels)
  const typeRadios = document.querySelectorAll('input[name="type"]');
  typeRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const isRent = e.target.value === 'rent';
      const depositGroup = document.getElementById('depositGroup');
      const priceLabel = document.getElementById('priceLabel');

      if (depositGroup) depositGroup.style.display = isRent ? 'flex' : 'none';
      if (priceLabel) priceLabel.textContent = isRent ? 'Monthly Rental Rate ($) *' : 'Listing Sale Price ($) *';
    });
  });

  // Next / Prev Step Handlers
  document.getElementById('nextStepBtn')?.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      goToStep(currentStep + 1);
    }
  });

  document.getElementById('prevStepBtn')?.addEventListener('click', () => {
    goToStep(currentStep - 1);
  });

  // Setup Gallery File Input & Drag and Drop
  setupGalleryUpload();

  // Initialize with 2 default virtual tour room templates
  addVirtualTourRoomField('Living Room', 'Main spacious living hall with natural lighting');
  addVirtualTourRoomField('Kitchen', 'Modern kitchen area with stainless appliances');

  // Form Submission
  document.getElementById('listPropertyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPropertyListing();
  });
});

function setupGalleryUpload() {
  const dropzone = document.getElementById('galleryDropzone');
  const fileInput = document.getElementById('galleryFileInput');

  if (!dropzone || !fileInput) return;

  fileInput.addEventListener('change', (e) => {
    handleGalleryFiles(Array.from(e.target.files));
  });
  if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
  if (nextBtn) nextBtn.style.display = step === totalSteps ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = step === totalSteps ? 'inline-flex' : 'none';

  if (step === totalSteps) {
    populateReviewSummary();
  }

  window.scrollTo({ top: 150, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const title = document.getElementById('propTitle')?.value.trim();
    const city = document.getElementById('propCity')?.value.trim();
    const address = document.getElementById('propAddress')?.value.trim();
    const state = document.getElementById('propState')?.value.trim();

    if (!title || !city || !address || !state) {
      showToast('Please complete property title, address, city, and state.', 'error');
      return false;
    }
  } else if (step === 2) {
    const price = document.getElementById('propPrice')?.value;
    const area = document.getElementById('propArea')?.value;

    if (!price || parseFloat(price) <= 0 || !area || parseInt(area) <= 0) {
      showToast('Please enter a valid price and square footage.', 'error');
      return false;
    }
  }
  return true;
}

function populateReviewSummary() {
  const title = document.getElementById('propTitle')?.value || '';
  const type = document.querySelector('input[name="type"]:checked')?.value || 'buy';
  const propType = document.getElementById('propCategory')?.value || 'apartment';
  const price = document.getElementById('propPrice')?.value || 0;
  const city = document.getElementById('propCity')?.value || '';
  const area = document.getElementById('propArea')?.value || 0;
  const beds = document.getElementById('propBeds')?.value || 1;
  const baths = document.getElementById('propBaths')?.value || 1;

  document.getElementById('reviewTitle').textContent = title;
  document.getElementById('reviewPrice').textContent = type === 'rent' ? `$${Number(price).toLocaleString()}/month` : `$${Number(price).toLocaleString()}`;
  document.getElementById('reviewLocation').textContent = `${city} • ${propType.toUpperCase()}`;
  document.getElementById('reviewSpecs').textContent = `${beds} Beds • ${baths} Baths • ${Number(area).toLocaleString()} sqft`;
}

async function submitPropertyListing() {
  const token = localStorage.getItem('homesphere_token');
  const submitBtn = document.getElementById('submitPropertyBtn');

  const title = document.getElementById('propTitle').value.trim();
  const description = document.getElementById('propDescription').value.trim() || 'Exquisite modern residence with verified documentation.';
  const type = document.querySelector('input[name="type"]:checked').value;
  const property_type = document.getElementById('propCategory').value;
  const price = parseFloat(document.getElementById('propPrice').value);
  const deposit = parseFloat(document.getElementById('propDeposit')?.value || 0);
  const lease_term = document.getElementById('propLease')?.value || '12 months';
  const address = document.getElementById('propAddress').value.trim();
  const city = document.getElementById('propCity').value.trim();
  const state = document.getElementById('propState').value.trim();
  const zip_code = document.getElementById('propZip')?.value.trim() || '';
  const bedrooms = parseInt(document.getElementById('propBeds').value);
  const bathrooms = parseFloat(document.getElementById('propBaths').value);
  const area_sqft = parseInt(document.getElementById('propArea').value);
  const year_built = parseInt(document.getElementById('propYearBuilt')?.value || 2023);
  const furnishing = document.getElementById('propFurnishing').value;
  const parking_spaces = parseInt(document.getElementById('propParking')?.value || 1);
  const legal_status = document.getElementById('propLegalStatus')?.value || 'Clear Freehold Title';
  const structural_notes = document.getElementById('propStructuralNotes')?.value || 'Reinforced concrete foundation';
  const primary_image_url = document.getElementById('propImageUrl')?.value.trim();

  // Gather selected amenities
  const checkedAmenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map((cb) => cb.value);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating AI DNA & Publishing...';

  try {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        description,
        type,
        property_type,
        price,
        deposit,
        lease_term,
        address,
        city,
        state,
        zip_code,
        bedrooms,
        bathrooms,
        area_sqft,
        year_built,
        furnishing,
        parking_spaces,
        legal_status,
        structural_notes,
        amenities_json: checkedAmenities,
        primary_image_url
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to list property.');
    }

    showToast('Listing published! AI Trust Score & Property DNA generated.', 'success');

    setTimeout(() => {
      window.location.href = `/property-details.html?id=${data.data.property_id}`;
    }, 1200);
  } catch (err) {
    showToast(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Publish Listing & Generate AI DNA';
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
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}


















































































































































  const beds = document.getElementById('propBeds')?.value || 1;
  const baths = document.getElementById('propBaths')?.value || 1;

  document.getElementById('reviewTitle').textContent = title;
  document.getElementById('reviewPrice').textContent = type === 'rent' ? `$${Number(price).toLocaleString()}/month` : `$${Number(price).toLocaleString()}`;
  document.getElementById('reviewLocation').textContent = `${city} • ${propType.toUpperCase()}`;
  document.getElementById('reviewSpecs').textContent = `${beds} Beds • ${baths} Baths • ${Number(area).toLocaleString()} sqft`;

  const validRoomsCount = virtualTourRooms.filter((r) => r.file).length;
  document.getElementById('reviewMediaCount').textContent = `${selectedGalleryFiles.length} Gallery Photos • ${validRoomsCount} Virtual Tour Rooms`;
}

async function submitPropertyListing() {
  const token = localStorage.getItem('homesphere_token');
  const submitBtn = document.getElementById('submitPropertyBtn');

  const title = document.getElementById('propTitle').value.trim();
  const description = document.getElementById('propDescription').value.trim() || 'Exquisite modern residence with verified documentation.';
  const type = document.querySelector('input[name="type"]:checked').value;
  const property_type = document.getElementById('propCategory').value;
  const price = parseFloat(document.getElementById('propPrice').value);
  const deposit = parseFloat(document.getElementById('propDeposit')?.value || 0);
  const lease_term = type === 'rent' ? '12 months' : 'N/A';
  const address = document.getElementById('propAddress').value.trim();
  const city = document.getElementById('propCity').value.trim();
  const state = document.getElementById('propState').value.trim();
  const zip_code = document.getElementById('propZip')?.value.trim() || '';
  const bedrooms = parseInt(document.getElementById('propBeds').value);
  const bathrooms = parseFloat(document.getElementById('propBaths').value);
  const area_sqft = parseInt(document.getElementById('propArea').value);
  const year_built = parseInt(document.getElementById('propYearBuilt')?.value || 2023);
  const furnishing = document.getElementById('propFurnishing').value;
  const parking_spaces = parseInt(document.getElementById('propParking')?.value || 1);
  const legal_status = document.getElementById('propLegalStatus')?.value || 'Clear Freehold Title';
  const structural_notes = document.getElementById('propStructuralNotes')?.value || 'Reinforced concrete foundation';

  // Gather selected amenities
  const checkedAmenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map((cb) => cb.value);

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Step 1/3: Creating Property Record...';

  try {
    // 1. Create Core Property Record
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        description,
        type,
        property_type,
        price,
        deposit,
        lease_term,
        address,
        city,
        state,
        zip_code,
        bedrooms,
        bathrooms,
        area_sqft,
        year_built,
        furnishing,
        parking_spaces,
        legal_status,
        structural_notes,
        deposit,
        lease_term,
        address,
        city,
        state,
        zip_code,
        bedrooms,
        bathrooms,
        area_sqft,
        year_built,
        furnishing,
        parking_spaces,
        legal_status,
        structural_notes,
        amenities_json: checkedAmenities
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      if (res.status === 401 || data.sessionInvalid) {
        localStorage.removeItem('homesphere_token');
        localStorage.removeItem('homesphere_user');
        showToast(data.message || 'Session expired or account not found in database. Please log in or register.', 'error');
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
      }
      throw new Error(data.message || 'Failed to list property.');
    }

    const propertyId = data.data.property_id;

    // 2. Upload Gallery Photos if selected
    if (selectedGalleryFiles.length > 0) {
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Step 2/3: Uploading ${selectedGalleryFiles.length} Photos...`;

      const formData = new FormData();
      selectedGalleryFiles.forEach((file) => {
        formData.append('images', file);
      });
      formData.append('primary_index', primaryGalleryIndex);

      const uploadRes = await fetch(`/api/properties/${propertyId}/images`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        console.warn('Gallery upload notice:', uploadData.message);
      }
    }

    // 3. Upload Virtual Tour Rooms if configured
    const roomsWithFiles = virtualTourRooms.filter((r) => r.file);
    if (roomsWithFiles.length > 0) {
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Step 3/3: Building Virtual Tour (${roomsWithFiles.length} Rooms)...`;

      for (let i = 0; i < roomsWithFiles.length; i++) {
        const room = roomsWithFiles[i];
        const roomFormData = new FormData();
        roomFormData.append('tour_images', room.file);
        roomFormData.append('room_name', room.name || `Room ${i + 1}`);
        roomFormData.append('room_description', room.description || '');
        roomFormData.append('display_order', i);
        roomFormData.append('is_panoramic', room.is_panoramic ? '1' : '0');

        await fetch(`/api/properties/${propertyId}/virtual-tour`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: roomFormData
        });
      }
    }

    showToast('Listing published! Photos and Virtual Tour uploaded successfully.', 'success');

    setTimeout(() => {
      window.location.href = `/property-details.html?id=${propertyId}`;
    }, 1200);
  } catch (err) {
    showToast(err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Publish Listing with Photos & Virtual Tour';
  }
}