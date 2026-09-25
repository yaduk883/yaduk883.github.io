// --- Supabase Configuration ---
const supabaseUrl = 'https://plwtfwylrlintbnvhfha.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsd3Rmd3lscmxpbnRibnZoZmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjIxODQsImV4cCI6MjEwNTYzODE4NH0.Y65Dhadml3pFMyytXro0drSprdYY-IOr4jQJ3tfL3F8';
// IMPORTANT: named `supabaseClient` (not `supabase`) — declaring `const supabase =
// supabase.createClient(...)` would shadow the global `supabase` object from the CDN
// script and throw a ReferenceError before the app can run.
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const LANGUAGE = 'MALAYALAM'; // single-language build
let searchTimeout = null;
let searchSeq = 0; // guards against slow/out-of-order network responses overwriting newer results

// --- Collapsible panel helpers (smooth grid-rows expand/collapse) ---
function openPanel(id, toggleBtnId) {
    document.getElementById(id).classList.add('is-open');
    if (toggleBtnId) document.getElementById(toggleBtnId).setAttribute('aria-expanded', 'true');
}
function closePanel(id, toggleBtnId) {
    document.getElementById(id).classList.remove('is-open');
    if (toggleBtnId) document.getElementById(toggleBtnId).setAttribute('aria-expanded', 'false');
}
function isPanelOpen(id) {
    return document.getElementById(id).classList.contains('is-open');
}

// --- Lightweight non-blocking toast (replaces alert()) ---
function showToast(message, type = 'info') {
    let holder = document.getElementById('toastHolder');
    if (!holder) {
        holder = document.createElement('div');
        holder.id = 'toastHolder';
        holder.setAttribute('aria-live', 'polite');
        document.body.appendChild(holder);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    holder.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
}

async function init() {
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = "Connected";
    closePanel('bookTableContainer');
    closePanel('descriptionArea');
    document.getElementById('searchInput').value = '';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const loggedIn = !!session;
        document.getElementById('loginForm').style.display = loggedIn ? 'none' : 'block';
        document.getElementById('entryForm').style.display = loggedIn ? 'block' : 'none';
    } catch (e) {
        console.error('Session check failed:', e);
    }
}

// Escapes characters that have special meaning to the database before they're
// dropped into a raw filter string, so typing %, _, or , doesn't act as a wildcard
// or accidentally break the OR-condition syntax.
function escapeForSupabaseFilter(str) {
    return str.replace(/[%_,()\\]/g, '\\$&');
}

// --- Bidirectional live search (English <-> Malayalam), debounced + race-safe ---
async function filterData(query) {
    const q = query.toLowerCase().trim();
    const status = document.getElementById('statusMessage');
    const mySeq = ++searchSeq; // any older in-flight request will be discarded on arrival

    if (!q) {
        closePanel('bookTableContainer');
        closePanel('descriptionArea');
        status.textContent = "Ready";
        return;
    }

    status.innerHTML = '<span class="spinner" aria-hidden="true"></span> Searching…';
    closePanel('descriptionArea');

    const safeQ = escapeForSupabaseFilter(q);

    try {
        // Search both English and Malayalam columns simultaneously
        const { data, error } = await supabaseClient
            .from('dictionary')
            .select('*')
            .eq('language', LANGUAGE)
            .or(`english_word.ilike.%${safeQ}%,translation.ilike.%${safeQ}%`)
            .limit(50);

        if (mySeq !== searchSeq) return; // a newer keystroke already superseded this request
        if (error) throw error;

        const groupedData = {};
        data.forEach(item => {
            if (!groupedData[item.english_word]) groupedData[item.english_word] = [];
            groupedData[item.english_word].push(item);
        });

        // Single source of truth for relevance, used identically for sorting AND
        // highlighting below, so the two can never disagree with each other.
        //   0 = exact match (English word or a Malayalam translation equals the query)
        //   1 = prefix match (English word or a Malayalam translation starts with the query)
        //   2 = anything else that matched the database ILIKE search
        const matches = Object.keys(groupedData)
            .map(word => ({ word, rank: relevanceRank(word, groupedData[word], q) }))
            .sort((x, y) => {
                if (x.rank !== y.rank) return x.rank - y.rank;
                return x.word.trim().toLowerCase().localeCompare(y.word.trim().toLowerCase());
            });

        renderTable(matches, groupedData);
        status.textContent = "Ready";
    } catch (e) {
        if (mySeq !== searchSeq) return;
        status.textContent = "Search error — try again";
        console.error("Fetch error:", e);
    }
}

// Ranks a dictionary headword against the (already trimmed + lowercased) search term `q`.
// Trims and lowercases every value it compares so stray whitespace or mixed case in the
// database can never cause an exact match to be missed.
function relevanceRank(word, entries, q) {
    const wordNorm = (word || '').trim().toLowerCase();
    if (wordNorm === q) return 0;
    if (entries.some(e => (e.translation || '').trim().toLowerCase() === q)) return 0;

    if (wordNorm.startsWith(q)) return 1;
    if (entries.some(e => (e.translation || '').trim().toLowerCase().startsWith(q))) return 1;

    return 2;
}

function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    const value = e.target.value;
    searchTimeout = setTimeout(() => filterData(value), 300);
}

function renderTable(matches, groupedData) {
    const tbody = document.getElementById('bookTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (matches.length === 0) {
        closePanel('bookTableContainer');
        document.getElementById('statusMessage').textContent = "No results found";
        return;
    }

    openPanel('bookTableContainer');

    // textContent only — never innerHTML — for anything sourced from the database
    matches.forEach(({ word, rank }, i) => {
        const row = tbody.insertRow();
        row.classList.add('row-in');
        row.style.animationDelay = `${Math.min(i, 15) * 18}ms`;
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.onclick = () => showDetails(word, groupedData[word]);
        row.onkeydown = (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                showDetails(word, groupedData[word]);
            }
        };

        if (rank === 0) row.classList.add("exact-match-row");

        const cellEng = row.insertCell();
        cellEng.textContent = word;

        const cellTr = row.insertCell();
        cellTr.textContent = groupedData[word].map(item => item.translation).join(", ");
    });
}

function showDetails(word, entries) {
    closePanel('bookTableContainer');
    const container = document.getElementById('definitionText');
    container.innerHTML = '';

    entries.forEach(e => {
        const item = document.createElement('div');
        item.className = 'detail-item';

        const p = document.createElement('p');
        p.className = 'detail-translation';
        p.appendChild(document.createTextNode(e.translation || ''));

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-btn-mini';
        copyBtn.innerHTML = '<svg width="13" height="13"><use href="#icon-copy"/></svg>';
        copyBtn.setAttribute('aria-label', 'Copy translation to clipboard');
        copyBtn.onclick = async (ev) => {
            ev.stopPropagation();
            try {
                await navigator.clipboard.writeText(e.translation || '');
                copyBtn.innerHTML = '<svg width="13" height="13"><use href="#icon-check"/></svg>';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = '<svg width="13" height="13"><use href="#icon-copy"/></svg>';
                    copyBtn.classList.remove('copied');
                }, 1200);
            } catch (err) {
                showToast('Could not copy to clipboard', 'error');
            }
        };
        p.appendChild(copyBtn);
        item.appendChild(p);

        if (e.extra_info) {
            const tagP = document.createElement('p');
            tagP.className = 'detail-tag';
            const em = document.createElement('em');
            em.textContent = `Grammar tag: ${e.extra_info}`;
            tagP.appendChild(em);
            item.appendChild(tagP);
        }

        container.appendChild(item);
    });

    const titleEl = document.getElementById('descriptionTitle');
    titleEl.textContent = word;
    // retrigger the headword's entrance animation on every lookup, not just the first
    titleEl.classList.remove('headword');
    void titleEl.offsetWidth;
    titleEl.classList.add('headword');

    openPanel('descriptionArea');
    document.getElementById('descriptionArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Supabase Admin Auth ---
async function performLogin() {
    const btn = document.querySelector('#loginForm .btn-primary');
    const email = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;

    if (!email || !pass) {
        showToast('Enter email and password', 'error');
        return;
    }

    setButtonLoading(btn, true);
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;

        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('entryForm').style.display = 'block';
        document.getElementById('adminUser').value = '';
        document.getElementById('adminPass').value = '';
        showToast('Login successful', 'success');
    } catch (e) {
        showToast('Login failed: ' + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function saveNewWord() {
    const btn = document.querySelector('#entryForm .btn-primary');
    const english_word = document.getElementById('newEnglish').value.trim();
    const translation = document.getElementById('newTranslation').value.trim();
    const extra_info = document.getElementById('newType').value.trim();

    if (!english_word || !translation) {
        showToast('English word and Malayalam translation are required', 'error');
        return;
    }

    setButtonLoading(btn, true);
    try {
        const { error } = await supabaseClient
            .from('dictionary')
            .insert([{ language: LANGUAGE, english_word, translation, extra_info }]);

        if (error) throw error;

        showToast('Saved successfully', 'success');
        document.getElementById('newEnglish').value = '';
        document.getElementById('newTranslation').value = '';
        document.getElementById('newType').value = '';
        document.getElementById('newEnglish').focus();
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.error('Logout error:', e);
    }
    closePanel('adminPanel', 'adminLoginBtn');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('adminPass').value = '';
}

// --- Restore saved theme before first interaction ---
if (localStorage.getItem('dict_theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

// --- Event wiring ---
document.getElementById('searchInput').addEventListener('input', handleSearchInput);
document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        filterData(e.target.value);
    } else if (e.key === 'Escape') {
        e.target.value = '';
        clearTimeout(searchTimeout);
        filterData('');
        e.target.blur();
    }
});

document.getElementById('backButton').addEventListener('click', () => {
    closePanel('descriptionArea');
    openPanel('bookTableContainer');
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spin-once');
    setTimeout(() => btn.classList.remove('spin-once'), 650);
    init();
});

document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('dict_theme', isDark ? 'dark' : 'light');
});

document.getElementById('adminLoginBtn').addEventListener('click', () => {
    if (isPanelOpen('adminPanel')) {
        closePanel('adminPanel', 'adminLoginBtn');
    } else {
        closePanel('contactArea', 'contactButton');
        openPanel('adminPanel', 'adminLoginBtn');
    }
});

document.getElementById('contactButton').addEventListener('click', () => {
    if (isPanelOpen('contactArea')) {
        closePanel('contactArea', 'contactButton');
    } else {
        closePanel('adminPanel', 'adminLoginBtn');
        openPanel('contactArea', 'contactButton');
    }
});

document.getElementById('adminPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performLogin();
});

init();
