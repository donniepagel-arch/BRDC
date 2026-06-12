import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

// Inject styles once
const style = document.createElement('style');
style.textContent = `
  .org-switcher { display:flex; gap:4px; background:rgba(255,255,255,0.1); border-radius:20px; padding:3px; }
  .org-btn { padding:4px 12px; border-radius:16px; border:none; font-size:11px; font-weight:700; letter-spacing:1px; cursor:pointer; background:transparent; color:rgba(255,255,255,0.6); transition:background 0.2s,color 0.2s; }
  .org-btn.active { background:#2e7db5; color:#fff; cursor:default; }
  .org-btn:not(.active):hover { background:rgba(255,255,255,0.15); color:rgba(255,255,255,0.9); }
`;
document.head.appendChild(style);

export async function detectUserOrgs(uid) {
  const db = getFirestore(getApp());
  const orgs = [];

  try {
    const ledaSnap = await getDoc(doc(db, 'organizations', 'leda', 'players', uid));
    if (ledaSnap.exists()) {
      orgs.push({ orgId: 'leda', label: 'LEDA', url: '/leda/member/home.html' });
    }
  } catch (e) { console.warn('org-switcher: LEDA check failed', e); }

  try {
    const brdcSnap = await getDoc(doc(db, 'players', uid));
    if (brdcSnap.exists()) {
      orgs.push({ orgId: 'brdc', label: 'BRDC', url: '/pages/dashboard.html' });
    }
  } catch (e) {
    if (e.code !== 'permission-denied') console.warn('org-switcher: BRDC check failed', e);
  }

  try {
    const ssdlSnap = await getDoc(doc(db, 'organizations', 'ssdl', 'players', uid));
    if (ssdlSnap.exists()) {
      orgs.push({ orgId: 'ssdl', label: 'SSDL', url: '/ssdl/member/home.html' });
    }
  } catch (e) { console.warn('org-switcher: SSDL check failed', e); }

  return orgs;
}

export function renderOrgSwitcher(orgs, currentOrgId, containerEl) {
  if (!containerEl || orgs.length <= 1) return;

  orgs = orgs.filter((org, index, all) => all.findIndex(o => o.orgId === org.orgId) === index);

  const switcherDiv = document.createElement('div');
  switcherDiv.classList.add('org-switcher');

  orgs.forEach(org => {
    const btn = document.createElement('button');
    btn.classList.add('org-btn');
    btn.textContent = org.label;
    if (org.orgId === currentOrgId) {
      btn.classList.add('active');
    } else {
      btn.addEventListener('click', () => {
        sessionStorage.setItem('orgId', org.orgId);
        window.location.href = org.url;
      });
    }
    switcherDiv.appendChild(btn);
  });

  containerEl.innerHTML = '';
  containerEl.appendChild(switcherDiv);
}
