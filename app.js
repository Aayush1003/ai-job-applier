const STORAGE_KEYS = {
  profile: 'careerpilot.profile.v1',
  applications: 'careerpilot.applications.v1',
};

const statuses = {
  saved: 'Saved',
  drafting: 'Drafting',
  ready: 'Ready to apply',
  applied: 'Applied',
};

const searchForm = document.querySelector('#search-form');
const searchLinks = document.querySelector('#search-links');
const applicationList = document.querySelector('#application-list');
const emptyState = document.querySelector('#empty-state');
const jobDialog = document.querySelector('#job-dialog');
const draftDialog = document.querySelector('#draft-dialog');
const jobForm = document.querySelector('#job-form');
const draftForm = document.querySelector('#draft-form');
const profileForm = document.querySelector('#profile-form');
const aiKeyForm = document.querySelector('#ai-key-form');
const toast = document.querySelector('#toast');
const aiStatus = document.querySelector('#ai-status');
const aiKeyInput = document.querySelector('#ai-api-key');
let applications = loadJson(STORAGE_KEYS.applications, []);
let profile = loadJson(STORAGE_KEYS.profile, {});
let activeApplicationId = null;
let activeDraftSource = 'local';
let toastTimeout;

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    showToast('Could not read saved data. Check browser storage settings.');
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to local storage.`, error);
    showToast('Could not save data. Check browser storage settings.');
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 2800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function updateSummary() {
  const total = applications.length;
  const inProgress = applications.filter((application) => ['drafting', 'ready'].includes(application.status)).length;
  const submitted = applications.filter((application) => application.status === 'applied').length;
  document.querySelector('#stat-total').textContent = total;
  document.querySelector('#stat-progress').textContent = inProgress;
  document.querySelector('#stat-submitted').textContent = submitted;
  document.querySelector('#nav-count').textContent = total;
  document.querySelector('#heading-count').textContent = total;
}

function renderApplications() {
  const filter = document.querySelector('#status-filter').value;
  const visibleApplications = applications.filter((application) => filter === 'all' || application.status === filter);
  applicationList.innerHTML = visibleApplications.map((application) => {
    const title = escapeHtml(application.title);
    const company = escapeHtml(application.company);
    const date = new Date(application.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const status = statuses[application.status] || statuses.saved;
    const safeUrl = isHttpUrl(application.url) ? application.url : '';
    return `
      <article class="application-card" data-id="${escapeHtml(application.id)}">
        <div class="company-mark" aria-hidden="true">${escapeHtml(company.slice(0, 1).toUpperCase())}</div>
        <div class="job-info">
          <h3>${title}</h3>
          <p>${company}</p>
          <span class="job-status ${escapeHtml(application.status)}">${status}</span>
        </div>
        <div class="job-meta">
          <span>Added ${date}</span>
        </div>
        <div class="card-actions">
          <button class="small-button draft-button" type="button" data-action="draft" data-id="${escapeHtml(application.id)}">Prepare draft</button>
          <button class="small-button" type="button" data-action="toggle-applied" data-id="${escapeHtml(application.id)}">${application.status === 'applied' ? 'Undo applied' : 'Mark applied'}</button>
          ${safeUrl ? `<a class="small-button" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">View job ↗</a>` : ''}
          <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(application.id)}" aria-label="Remove ${title} at ${company}">Remove</button>
        </div>
      </article>`;
  }).join('');
  emptyState.hidden = applications.length > 0;
  applicationList.hidden = visibleApplications.length === 0;
  updateSummary();
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function fillProfileForm() {
  for (const [key, value] of Object.entries(profile)) {
    const field = profileForm.elements.namedItem(key);
    if (field) field.value = value;
  }
  updateHeaderName();
}

function updateHeaderName() {
  const name = profile.name?.trim();
  document.querySelector('#header-name').textContent = name || 'Your profile';
  document.querySelector('#avatar-initial').textContent = name ? name.charAt(0).toUpperCase() : 'Y';
}

function prepareDraft(application) {
  const name = profile.name?.trim() || '[Your name]';
  const title = application.title.trim();
  const company = application.company.trim();
  const skills = (profile.skills || '').split(',').map((skill) => skill.trim()).filter(Boolean);
  const summary = profile.summary?.trim();
  const highlights = profile.highlights?.trim();
  const description = application.description?.trim();
  const selectedSkills = skills.length ? skills.slice(0, 5).join(', ') : '[Add relevant skills from your profile]';
  const roleContext = description
    ? `\n\nI was particularly interested in the role's focus on ${description.slice(0, 220).replace(/\s+/g, ' ').replace(/[.!?]+$/, '')}${description.length > 220 ? '…' : ''}`
    : '';
  const paragraphs = [
    `Dear ${company} Hiring Team,`,
    `\nI am writing to express my interest in the ${title} position at ${company}. ${summary || `My experience with ${selectedSkills} has prepared me to contribute thoughtfully to this role.`}${roleContext}.`,
  ];

  if (highlights) paragraphs.push(`\nIn my previous work, ${highlights}`);
  else paragraphs.push(`\nI would welcome the opportunity to discuss how my background in ${selectedSkills} could support your team.`);

  paragraphs.push(`\nThank you for your consideration. I look forward to the possibility of speaking with you.\n\nSincerely,\n${name}`);
  return paragraphs.join('\n');
}

function openDraft(applicationId) {
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return;
  activeApplicationId = applicationId;
  activeDraftSource = application.draftSource || 'local';
  document.querySelector('#draft-title').textContent = `Draft for ${application.title}`;
  draftForm.elements.coverLetter.value = application.draft || prepareDraft(application);
  updateDraftProvenance();
  document.querySelector('#draft-message').textContent = '';
  draftDialog.showModal();
}

function updateDraftProvenance() {
  const provenance = document.querySelector('#draft-provenance');
  provenance.textContent = activeDraftSource === 'openai'
    ? 'AI-assisted draft generated with OpenAI. Review every detail for accuracy and edit it to reflect your own experience.'
    : 'Local starting point. Review it for accuracy and make it your own before using it.';
  provenance.classList.toggle('ai-generated', activeDraftSource === 'openai');
}

function saveDraft(status = 'drafting') {
  const application = applications.find((item) => item.id === activeApplicationId);
  if (!application) return;
  application.draft = draftForm.elements.coverLetter.value;
  application.draftSource = activeDraftSource;
  application.status = status;
  if (!saveJson(STORAGE_KEYS.applications, applications)) return;
  renderApplications();
  showToast(status === 'ready' ? 'Marked ready. Review it on the company portal before submitting.' : 'Draft saved on this device.');
}

async function refreshAiStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error(`Local server returned HTTP ${response.status}.`);
    const status = await response.json();
    aiStatus.dataset.configured = String(status.configured);
    aiStatus.textContent = status.configured
      ? 'AI drafts are ready. Your API key is held only in this running local server.'
      : 'To enable AI drafts, add your OpenAI API key below. It will be held in server memory only.';
  } catch (error) {
    console.error('Could not check local AI server status:', error);
    aiStatus.dataset.configured = 'false';
    aiStatus.textContent = 'Local server unavailable. Start CareerPilot with “node server.js” to enable AI drafts.';
  }
}

async function generateAiDraft() {
  const button = document.querySelector('#generate-ai-draft');
  const message = document.querySelector('#draft-message');
  const application = applications.find((item) => item.id === activeApplicationId);
  if (!application) return;
  button.disabled = true;
  button.textContent = 'Generating…';
  message.textContent = 'Sending selected profile and job details to OpenAI for this draft.';
  message.classList.remove('error-message');
  const currentProfile = Object.fromEntries(new FormData(profileForm).entries());
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: currentProfile.name,
        summary: currentProfile.summary,
        skills: currentProfile.skills,
        highlights: currentProfile.highlights,
        title: application.title,
        company: application.company,
        description: application.description,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Draft generation failed (HTTP ${response.status}).`);
    draftForm.elements.coverLetter.value = result.draft;
    activeDraftSource = 'openai';
    updateDraftProvenance();
    message.textContent = 'Draft generated. Review and edit it before saving or using it.';
  } catch (error) {
    console.error('Could not generate AI draft:', error);
    message.textContent = error.message || 'Could not generate a draft. Check your local server and try again.';
    message.classList.add('error-message');
  } finally {
    button.disabled = false;
    button.textContent = 'Generate with OpenAI';
  }
}

function addApplication(formData) {
  const url = formData.get('url').trim();
  if (url && !isHttpUrl(url)) {
    showToast('Enter a valid job URL starting with http:// or https://.');
    return false;
  }
  applications.unshift({
    id: crypto.randomUUID(),
    title: formData.get('title').trim(),
    company: formData.get('company').trim(),
    url,
    description: formData.get('description').trim(),
    status: 'saved',
    createdAt: new Date().toISOString(),
    draft: '',
  });
  if (!saveJson(STORAGE_KEYS.applications, applications)) return false;
  renderApplications();
  return true;
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const role = document.querySelector('#search-role').value.trim();
  const location = document.querySelector('#search-location').value.trim();
  const query = [role, location].filter(Boolean).join(' ');
  const encodedQuery = encodeURIComponent(query);
  const boards = [
    ['Google Jobs', `https://www.google.com/search?q=${encodedQuery}&ibp=htl;jobs`],
    ['Indeed', `https://www.indeed.com/jobs?q=${encodeURIComponent(role)}${location ? `&l=${encodeURIComponent(location)}` : ''}`],
    ['LinkedIn', `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}${location ? `&location=${encodeURIComponent(location)}` : ''}`],
  ];
  searchLinks.replaceChildren(...boards.map(([label, href]) => {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Search ${label} ↗`;
    return link;
  }));
  searchLinks.hidden = false;
});

document.querySelectorAll('[data-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.target);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (button.dataset.target === 'search') document.querySelector('#search-role').focus({ preventScroll: true });
  });
});

document.querySelectorAll('[data-open-job-dialog]').forEach((button) => {
  button.addEventListener('click', () => jobDialog.showModal());
});

document.querySelector('#status-filter').addEventListener('change', renderApplications);

applicationList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'draft') openDraft(button.dataset.id);
  if (button.dataset.action === 'delete') {
    applications = applications.filter((application) => application.id !== button.dataset.id);
    if (saveJson(STORAGE_KEYS.applications, applications)) {
      renderApplications();
      showToast('Opportunity removed.');
    }
  }
  if (button.dataset.action === 'toggle-applied') {
    const application = applications.find((item) => item.id === button.dataset.id);
    if (!application) return;
    application.status = application.status === 'applied' ? (application.draft ? 'ready' : 'saved') : 'applied';
    if (saveJson(STORAGE_KEYS.applications, applications)) {
      renderApplications();
      showToast(application.status === 'applied' ? 'Marked as applied.' : 'Application moved back to your pipeline.');
    }
  }
});

jobForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const added = addApplication(new FormData(jobForm));
  if (added) {
    jobDialog.close();
    jobForm.reset();
    showToast('Opportunity saved to your pipeline.');
  }
});

['#close-dialog', '#cancel-dialog'].forEach((selector) => {
  document.querySelector(selector).addEventListener('click', () => jobDialog.close());
});

document.querySelector('#close-draft').addEventListener('click', () => draftDialog.close());
document.querySelector('#save-draft').addEventListener('click', () => saveDraft());
document.querySelector('#mark-ready').addEventListener('click', () => saveDraft('ready'));
document.querySelector('#generate-ai-draft').addEventListener('click', generateAiDraft);
document.querySelector('#copy-draft').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draftForm.elements.coverLetter.value);
    document.querySelector('#draft-message').textContent = 'Draft copied to clipboard.';
  } catch (error) {
    console.error('Unable to copy draft to clipboard.', error);
    document.querySelector('#draft-message').textContent = 'Clipboard access was blocked. Select and copy the draft manually.';
  }
});

aiKeyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = aiKeyForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  aiStatus.textContent = 'Saving API key to this server session…';
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: aiKeyInput.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Could not save API key (HTTP ${response.status}).`);
    aiKeyInput.value = '';
    await refreshAiStatus();
  } catch (error) {
    console.error('Could not configure OpenAI:', error);
    aiStatus.dataset.configured = 'false';
    aiStatus.textContent = error.message || 'Could not configure OpenAI. Check that the local server is running.';
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#clear-ai-key').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch('/api/config', { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Could not clear API key (HTTP ${response.status}).`);
    aiKeyInput.value = '';
    await refreshAiStatus();
  } catch (error) {
    console.error('Could not clear OpenAI key:', error);
    aiStatus.textContent = error.message || 'Could not clear the API key from the local server.';
  } finally {
    button.disabled = false;
  }
});

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  profile = Object.fromEntries(new FormData(profileForm).entries());
  if (saveJson(STORAGE_KEYS.profile, profile)) {
    updateHeaderName();
    document.querySelector('#profile-message').textContent = 'Saved on this device.';
    window.setTimeout(() => { document.querySelector('#profile-message').textContent = ''; }, 2500);
  }
});

document.querySelector('#applications').addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (link && !isHttpUrl(link.href)) {
    event.preventDefault();
    showToast('This job link is not a valid web address.');
  }
});

fillProfileForm();
renderApplications();
refreshAiStatus();
