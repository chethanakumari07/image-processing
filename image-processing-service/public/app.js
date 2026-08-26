// STATE 
// We keep the JWT in localStorage so a page refresh doesn't log the user out. 
let token = localStorage.getItem('token');
let activeImageId = null;

// DOM REFERENCES 

const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const logoutBtn = document.getElementById('logoutBtn');

const showLoginTab = document.getElementById('showLoginTab');
const showRegisterTab = document.getElementById('showRegisterTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadError = document.getElementById('uploadError');
const gallery = document.getElementById('gallery');

const transformModal = document.getElementById('transformModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const applyTransformBtn = document.getElementById('applyTransformBtn');
const transformError = document.getElementById('transformError');
const transformResult = document.getElementById('transformResult');

// SMALL FETCH HELPER
async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong.');
  }

  return data;
}

// AUTH

// Tab switching between the Login and Sign Up forms.
showLoginTab.addEventListener('click', () => {
  showLoginTab.classList.add('active');
  showRegisterTab.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

showRegisterTab.addEventListener('click', () => {
  showRegisterTab.classList.add('active');
  showLoginTab.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    token = data.token;
    localStorage.setItem('token', token);
    enterApp();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';

  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    token = data.token;
    localStorage.setItem('token', token);
    enterApp();
  } catch (err) {
    registerError.textContent = err.message;
  }
});

logoutBtn.addEventListener('click', () => {
  token = null;
  localStorage.removeItem('token');
  showAuthScreen();
});

// Switches from the auth screen to the main app screen and loads the user's existing images.
function enterApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loadGallery();
}

function showAuthScreen() {
  appSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
}

// On page load
if (token) {
  enterApp();
}
// UPLOAD
uploadBtn.addEventListener('click', async () => {
  uploadError.textContent = '';
  const file = fileInput.files[0];

  if (!file) {
    uploadError.textContent = 'Choose a file first.';
    return;
  }
  const formData = new FormData();
  formData.append('image', file);

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    await apiFetch('/api/images/upload', {
      method: 'POST',
      body: formData
    });

    fileInput.value = '';
    loadGallery();
  } catch (err) {
    uploadError.textContent = err.message;
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Image';
  }
});

// GALLERY

async function loadGallery() {
  gallery.innerHTML = '<p>Loading...</p>';

  try {
    const data = await apiFetch('/api/images?page=1&limit=20');
    renderGallery(data.images);
  } catch (err) {
    gallery.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

function renderGallery(images) {
  if (images.length === 0) {
    gallery.innerHTML = '<p>No images yet — upload one above.</p>';
    return;
  }

  // Building HTML with a template string per image
  gallery.innerHTML = images
    .map(
      (img) => `
      <div class="image-card">
        <img src="${img.url}" alt="${img.originalFilename}" />
        <div class="card-body">
          <p class="filename">${img.originalFilename}</p>
          <p class="dims">${img.width} × ${img.height}px</p>
          <button onclick="openTransformModal('${img.id}')">Transform</button>
        </div>
      </div>
    `
    )
    .join('');
}


// TRANSFORM MODAL

window.openTransformModal = function (imageId) {
  activeImageId = imageId;
  transformError.textContent = '';
  transformResult.innerHTML = '';
  transformModal.classList.remove('hidden');
};

closeModalBtn.addEventListener('click', () => {
  transformModal.classList.add('hidden');
  activeImageId = null;
});

// Clicking the dark overlay (outside the white box) also closes it.
transformModal.addEventListener('click', (e) => {
  if (e.target === transformModal) {
    transformModal.classList.add('hidden');
    activeImageId = null;
  }
});

applyTransformBtn.addEventListener('click', async () => {
  transformError.textContent = '';
  transformResult.innerHTML = '';
  const transformations = [];

  if (document.getElementById('optResize').checked) {
    transformations.push({
      type: 'resize',
      width: Number(document.getElementById('resizeWidth').value) || undefined,
      height: Number(document.getElementById('resizeHeight').value) || undefined
    });
  }

  if (document.getElementById('optRotate').checked) {
    transformations.push({
      type: 'rotate',
      angle: Number(document.getElementById('rotateAngle').value) || 0
    });
  }

  if (document.getElementById('optFlip').checked) {
    transformations.push({ type: 'flip' });
  }

  if (document.getElementById('optMirror').checked) {
    transformations.push({ type: 'mirror' });
  }

  if (document.getElementById('optWatermark').checked) {
    transformations.push({
      type: 'watermark',
      text: document.getElementById('watermarkText').value || 'WATERMARK'
    });
  }

  if (document.getElementById('optFilter').checked) {
    transformations.push({
      type: 'filter',
      name: document.getElementById('filterName').value
    });
  }

  if (document.getElementById('optCompress').checked) {
    transformations.push({
      type: 'compress',
      quality: Number(document.getElementById('compressQuality').value) || 80
    });
  }

  if (document.getElementById('optFormat').checked) {
    transformations.push({
      type: 'format',
      value: document.getElementById('formatValue').value
    });
  }

  if (transformations.length === 0) {
    transformError.textContent = 'Check at least one transformation.';
    return;
  }

  try {
    applyTransformBtn.disabled = true;
    applyTransformBtn.textContent = 'Processing...';

    const data = await apiFetch(`/api/images/${activeImageId}/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transformations })
    });

    transformResult.innerHTML = `
      <p>${data.cached ? '⚡ Served from cache' : '✅ Transformed'}</p>
      <img src="${data.transformation.url}" alt="Transformed result" />
      <br />
      <a href="${data.transformation.url}" target="_blank" rel="noopener">Open full size</a>
    `;
  } catch (err) {
    transformError.textContent = err.message;
  } finally {
    applyTransformBtn.disabled = false;
    applyTransformBtn.textContent = 'Apply Transformations';
  }
});
