/*global WildRydes _config $*/
// profile.js
// Same UI logic as the original app.js, but the auth/network layer now
// mirrors the Wild Rydes template's ride.js: gate on WildRydes.authToken
// (set by cognito-auth.js) and call a REST endpoint via jQuery $.ajax
// instead of the aws-amplify Data/Storage client.

var Cluster = window.Cluster || {};

// ─── Auth gate ────────────────────────────────────────────────────────────────
// Redirect to sign-in if there's no valid session, same as ride.js does
// before it lets you request a ride.
var authToken;
Cluster.authToken.then(function setAuthToken(token) {
    if (token) {
        authToken = token;
    } else {
        window.location.href = 'signin.html';
    }
}).catch(function handleTokenError(error) {
    console.error(error);
    window.location.href = 'signin.html';
});

if (!_config.api.invokeUrl) {
    console.warn('No API invoke URL configured in config.js yet.');
}

// ─── Server sync (API Gateway -> Lambda -> S3 + DynamoDB) ────────────────────
let coverDataUrl  = null;
let avatarDataUrl = null;

// Fire-and-forget: failures are logged but never block the local UI.
function syncToServer() {
  const payload = {
    profile: {
      fullName:  document.getElementById('input-full_name').value,
      email:     document.getElementById('input-email').value,
      title:     document.getElementById('sel-title').value,
      ethnicity: document.getElementById('sel-ethnicity').value,
      religion:  document.getElementById('sel-religion').value,
      city:      document.getElementById('sel-city').value,
      political: selectedPolitical || '',
    },
    photos: {
      cover:  coverDataUrl,
      avatar: avatarDataUrl,
    },
    journal: document.getElementById('journal-input').value,
  };

  $.ajax({
    method: 'POST',
    url: _config.api.invokeUrl + '/profile',
    headers: { Authorization: authToken },
    data: JSON.stringify(payload),
    contentType: 'application/json',
    success: function onSaveSuccess(result) {
      console.log('Saved:', result);
    },
    error: function onSaveError(jqXHR, textStatus, errorThrown) {
      console.warn('syncToServer failed (continuing offline):', textStatus, errorThrown);
    }
  });
}

// ─── Panel navigation ─────────────────────────────────────────────────────────
// Panel order: 0 = Profile, 1 = Menu, 2 = Settings, 3 = Political Identity, 4 = Journal
const track  = document.getElementById('track');
const dots   = document.querySelectorAll('.dot');
const PANEL_W = 340;
let current  = 0;

function goTo(index) {
  current = Math.max(0, Math.min(4, index));
  track.style.transform = `translateX(${-current * PANEL_W}px)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === current));
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  document.getElementById('clock').textContent = h + ':' + (m < 10 ? '0' : '') + m;
}
updateClock();
setInterval(updateClock, 10000);

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Sign out (added to match the template's "Account" menu concept) ─────────
function signOutAndRedirect() {
  Cluster.signOut();
  window.location.href = 'signin.html';
}

// ─── Photo uploads ────────────────────────────────────────────────────────────
document.getElementById('cover-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img  = document.getElementById('cover-img');
    const hint = document.getElementById('cover-hint');
    coverDataUrl = e.target.result;
    img.src = coverDataUrl;
    img.classList.add('loaded');
    hint.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

document.getElementById('avatar-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img         = document.getElementById('avatar-img');
    const placeholder = document.getElementById('avatar-placeholder');
    avatarDataUrl = e.target.result;
    img.src = avatarDataUrl;
    img.classList.add('loaded');
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// ─── Profile fields — save & update card ─────────────────────────────────────
function setChipValue(id, value) {
  const el = document.getElementById(id);
  if (value && value !== '') {
    el.textContent = value;
    el.classList.remove('empty');
  } else {
    el.textContent = 'Not set';
    el.classList.add('empty');
  }
}

function saveProfile() {
  const title     = document.getElementById('sel-title').value;
  const ethnicity = document.getElementById('sel-ethnicity').value;
  const religion  = document.getElementById('sel-religion').value;
  const city      = document.getElementById('sel-city').value;
  const nameinput = document.getElementById('input-full_name').value;
  const email     = document.getElementById('input-email').value;

  setChipValue('disp-title',     title     || '');
  setChipValue('disp-ethnicity', ethnicity || '');
  setChipValue('disp-religion',  religion  || '');
  setChipValue('disp-city',      city      || '');

  const nameEl = document.getElementById('disp-full_name');
  if (nameinput) {
    nameEl.textContent = nameinput;
    nameEl.classList.remove('empty');
  } else {
    nameEl.textContent = 'Your Name';
    nameEl.classList.add('empty');
  }
  setChipValue('disp-email', email || '');

  syncToServer();

  showToast('Profile updated ✓');
  setTimeout(() => goTo(0), 600);
}

// ─── Political identity (Panel 3) ────────────────────────────────────────────
let selectedPolitical = null;

function selectPolitical(el) {
  document.querySelectorAll('.political-option').forEach((btn) => btn.classList.remove('selected'));
  el.classList.add('selected');
  selectedPolitical = el.dataset.value;
}

function savePolitical() {
  if (!selectedPolitical) {
    showToast('Pick an option first');
    return;
  }
  syncToServer();

  showToast(`Saved: ${selectedPolitical} ✓`);
  setTimeout(() => goTo(1), 600);
}

// ─── Journal (Panel 4) ────────────────────────────────────────────────────────
function saveJournal() {
  const text = document.getElementById('journal-input').value.trim();
  const meta = document.getElementById('journal-meta');

  if (!text) {
    showToast('Nothing to save yet');
    return;
  }

  const now = new Date();
  meta.textContent = `Last saved ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  syncToServer();

  showToast('Journal entry saved ✓');
}
