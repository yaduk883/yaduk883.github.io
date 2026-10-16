// --- Supabase Configuration ---
const supabaseUrl = 'https://plwtfwylrlintbnvhfha.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsd3Rmd3lscmxpbnRibnZoZmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjIxODQsImV4cCI6MjEwNTYzODE4NH0.Y65Dhadml3pFMyytXro0drSprdYY-IOr4jQJ3tfL3F8';
// IMPORTANT: named `supabaseClient` (not `supabase`) — declaring `const supabase =
// supabase.createClient(...)` would shadow the global `supabase` object from the CDN
// script and throw a ReferenceError before the app can run.
// If the database library fails to load (blocked CDN, ad blocker, offline, or a missing
// <script> tag), createClient() used to throw right here and silently kill the WHOLE page:
// every button, search and Word of the Day. Now the failure is contained — the page keeps
// working and database features show a clear message instead.
let supabaseClient = null;
try {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('The Supabase library did not load');
    }
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (e) {
    console.error('Database unavailable:', e);
}
const DB_UNAVAILABLE_MSG = "Can't reach the dictionary database. Check your internet connection or ad blocker, then refresh.";

function dbAvailable() {
    if (supabaseClient) return true;
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = DB_UNAVAILABLE_MSG;
    return false;
}

// Browser storage can be blocked (some in-app browsers, strict privacy settings) and merely
// touching localStorage then THROWS. These wrappers make storage optional instead of fatal.
const safeStore = {
    get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } },
    set(store, key, value) { try { window[store].setItem(key, value); } catch (e) { /* storage unavailable — ignore */ } },
    remove(store, key) { try { window[store].removeItem(key); } catch (e) { /* storage unavailable — ignore */ } },
};

// Connects a handler to an element if it exists. A missing element (for example an older
// index.html paired with this script) is skipped instead of throwing and stopping every
// line after it.
function on(id, eventName, handler) {
    const el = document.getElementById(id);
    if (!el) { console.warn('#' + id + ' not found in the page — skipped'); return; }
    el.addEventListener(eventName, handler);
}

// Runs a startup task so that one failing task can't stop the next one from running.
function safeRun(fn) {
    try {
        const result = fn();
        if (result && typeof result.catch === 'function') result.catch(e => console.error(e));
    } catch (e) {
        console.error(e);
    }
}

const LANGUAGE = 'MALAYALAM'; // single-language build
let searchTimeout = null;
let searchSeq = 0; // guards against slow/out-of-order network responses overwriting newer results

// --- Collapsible panel helpers (smooth grid-rows expand/collapse) ---
function openPanel(id, toggleBtnId) {
    const el = document.getElementById(id);
    if (el) el.classList.add('is-open');
    const btn = toggleBtnId ? document.getElementById(toggleBtnId) : null;
    if (btn) btn.setAttribute('aria-expanded', 'true');
}
function closePanel(id, toggleBtnId) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-open');
    const btn = toggleBtnId ? document.getElementById(toggleBtnId) : null;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
function isPanelOpen(id) {
    const el = document.getElementById(id);
    return !!el && el.classList.contains('is-open');
}

// --- Text-to-speech (Web Speech API) ---
// Free and needs no backend, but voice availability — especially Malayalam — depends
// entirely on the visitor's device/OS. We detect and warn rather than fail silently.
let availableVoices = [];
try {
    if ('speechSynthesis' in window) {
        const loadVoices = () => { availableVoices = window.speechSynthesis.getVoices(); };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
} catch (e) {
    console.warn('Speech voices unavailable:', e);
}

function findVoiceFor(langCode) {
    const base = langCode.split('-')[0].toLowerCase();
    return availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith(base));
}

function speak(text, langCode, btn) {
    if (!text) return;

    if (!('speechSynthesis' in window)) {
        showToast('Speech is not supported in this browser', 'error');
        return;
    }

    const voice = findVoiceFor(langCode);
    if (!voice && langCode.startsWith('ml')) {
        showToast('This device has no Malayalam voice installed — pronunciation may be off or silent', 'info');
    }

    window.speechSynthesis.cancel(); // stop anything currently playing
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    if (voice) utterance.voice = voice;

    if (btn) {
        btn.classList.add('speaking');
        utterance.onend = () => btn.classList.remove('speaking');
        utterance.onerror = () => btn.classList.remove('speaking');
    }

    window.speechSynthesis.speak(utterance);
}

function makeSpeakButton(text, langCode, extraClass, ariaLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = extraClass ? `speak-btn-mini ${extraClass}` : 'speak-btn-mini';
    btn.innerHTML = '<svg width="12" height="12"><use href="#icon-volume"/></svg>';
    btn.setAttribute('aria-label', ariaLabel);
    btn.onclick = (ev) => {
        ev.stopPropagation();
        speak(text, langCode, btn);
    };
    return btn;
}


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
    closePanel('bookTableContainer');
    closePanel('descriptionArea');
    const searchEl = document.getElementById('searchInput');
    if (searchEl) searchEl.value = '';

    if (!dbAvailable()) return;
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = "Connected";

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const loggedIn = !!session;
        const loginForm = document.getElementById('loginForm');
        const entryForm = document.getElementById('entryForm');
        if (loginForm) loginForm.style.display = loggedIn ? 'none' : 'block';
        if (entryForm) entryForm.style.display = loggedIn ? 'block' : 'none';
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
    if (!dbAvailable()) return;
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
    const RESULT_LIMIT = 50;

    try {
        // Stage 1: words/translations that START WITH the query. This must be fetched
        // first and on its own — these are the results that always have to make it
        // into the list, no matter how many unrelated "contains" matches also exist.
        const { data: primary, error: err1 } = await supabaseClient
            .from('dictionary')
            .select('*')
            .eq('language', LANGUAGE)
            .or(`english_word.ilike.${safeQ}%,translation.ilike.${safeQ}%`)
            .limit(RESULT_LIMIT);

        if (mySeq !== searchSeq) return;
        if (err1) throw err1;

        // Stage 2: only if there's room left in the result budget, fill the rest with
        // words that merely CONTAIN the query elsewhere (and explicitly are not
        // already covered by stage 1, so the two sets never overlap or duplicate).
        let secondary = [];
        const remaining = RESULT_LIMIT - primary.length;
        if (remaining > 0) {
            const { data: sec, error: err2 } = await supabaseClient
                .from('dictionary')
                .select('*')
                .eq('language', LANGUAGE)
                .or(`english_word.ilike.%${safeQ}%,translation.ilike.%${safeQ}%`)
                .not('english_word', 'ilike', `${safeQ}%`)
                .not('translation', 'ilike', `${safeQ}%`)
                .limit(remaining);

            if (mySeq !== searchSeq) return;
            if (err2) throw err2;
            secondary = sec;
        }

        const data = [...primary, ...secondary];

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
        cellEng.classList.add('word-cell');
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word;
        cellEng.appendChild(wordSpan);
        cellEng.appendChild(makeSpeakButton(word, 'en-US', 'row-speak-btn', `Pronounce ${word}`));

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
        p.appendChild(makeSpeakButton(e.translation || '', 'ml-IN', null, `Pronounce ${e.translation || ''} in Malayalam`));
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
    titleEl.innerHTML = '';
    const titleText = document.createElement('span');
    titleText.textContent = word;
    titleEl.appendChild(titleText);
    titleEl.appendChild(makeSpeakButton(word, 'en-US', 'headword-speak-btn', `Pronounce ${word}`));
    // retrigger the headword's entrance animation on every lookup, not just the first
    titleEl.classList.remove('headword');
    void titleEl.offsetWidth;
    titleEl.classList.add('headword');

    openPanel('descriptionArea');
    document.getElementById('descriptionArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Word of the Day ---
// The word is chosen on the server (get_word_of_the_day(), see word_of_the_day.sql):
// one word per calendar day, the same for every visitor, picked by DISTINCT word and
// never repeated until the whole dictionary has had a turn. The browser only asks for
// today's word and caches it so there's one lookup per day, not per page load.
const WOTD_TIMEZONE = 'Asia/Kolkata'; // must match the timezone inside get_word_of_the_day() in word_of_the_day.sql

function todayKey() {
    // "YYYY-MM-DD" for the current day in WOTD_TIMEZONE (en-CA formats dates as ISO)
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: WOTD_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
}

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Used only if get_word_of_the_day() hasn't been installed in Supabase yet, so the
// page keeps working in the meantime. Hash-based, so consecutive days jump around
// instead of stepping through neighbouring rows one by one.
async function fallbackPickWord(today) {
    const { count, error: countErr } = await supabaseClient
        .from('dictionary')
        .select('*', { count: 'exact', head: true })
        .eq('language', LANGUAGE);
    if (countErr || !count) return null;

    const index = hashString(today) % count;
    const { data, error } = await supabaseClient
        .from('dictionary')
        .select('english_word')
        .eq('language', LANGUAGE)
        .order('english_word', { ascending: true })
        .range(index, index);
    if (error || !data || !data.length) return null;
    return { day: today, word: data[0].english_word };
}

async function pickWordOfDay(today) {
    const { data, error } = await supabaseClient.rpc('get_word_of_the_day', { p_language: LANGUAGE });
    if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        return row && row.english_word ? { day: row.day, word: row.english_word } : null;
    }
    console.warn('get_word_of_the_day() unavailable — run word_of_the_day.sql in Supabase. Using fallback:', error.message);
    return fallbackPickWord(today);
}

async function loadWordOfDay() {
    const section = document.getElementById('wordOfDay');
    if (!section) return;
    const today = todayKey();

    if (safeStore.get('sessionStorage', 'wotd_dismissed') === today) {
        section.style.display = 'none';
        return;
    }

    try {
        const cached = JSON.parse(safeStore.get('localStorage', 'wotd_cache') || 'null');
        if (cached && cached.day === today && cached.word && Array.isArray(cached.entries) && cached.entries.length) {
            renderWordOfDay(cached.word, cached.entries);
            return;
        }
    } catch (e) {
        // corrupt or old-format cache — fall through and refetch
    }

    if (!supabaseClient) { section.style.display = 'none'; return; }

    try {
        const picked = await pickWordOfDay(today);
        if (!picked) { section.style.display = 'none'; return; }

        const { data: entries, error: entriesErr } = await supabaseClient
            .from('dictionary')
            .select('*')
            .eq('language', LANGUAGE)
            .eq('english_word', picked.word);
        if (entriesErr) throw entriesErr;
        if (!entries || !entries.length) { section.style.display = 'none'; return; }

        safeStore.set('localStorage', 'wotd_cache', JSON.stringify({ day: picked.day, word: picked.word, entries }));
        renderWordOfDay(picked.word, entries);
    } catch (e) {
        console.error('Word of the Day failed to load:', e);
        section.style.display = 'none';
    }
}

function renderWordOfDay(word, entries) {
    const section = document.getElementById('wordOfDay');
    const wordEl = document.getElementById('wotdWord');
    const transEl = document.getElementById('wotdTranslations');

    wordEl.innerHTML = '';
    const wordText = document.createElement('span');
    wordText.textContent = word;
    wordEl.appendChild(wordText);
    wordEl.appendChild(makeSpeakButton(word, 'en-US', 'wotd-speak-btn', `Pronounce ${word}`));

    transEl.innerHTML = '';
    entries.forEach((e, i) => {
        const entrySpan = document.createElement('span');
        entrySpan.className = 'wotd-entry';
        const text = document.createElement('span');
        text.textContent = (e.translation || '') + (i < entries.length - 1 ? ',' : '');
        entrySpan.appendChild(text);
        entrySpan.appendChild(makeSpeakButton(e.translation || '', 'ml-IN', 'wotd-speak-btn', `Pronounce ${e.translation || ''} in Malayalam`));
        transEl.appendChild(entrySpan);
    });

    const body = section.querySelector('.wotd-body');
    body.onclick = () => showDetails(word, entries);
    body.tabIndex = 0;
    body.setAttribute('role', 'button');
    body.onkeydown = (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showDetails(word, entries); }
    };

    section.style.display = 'block';
}

// --- Supabase Admin Auth ---
async function performLogin() {
    if (!supabaseClient) { showToast(DB_UNAVAILABLE_MSG, 'error'); return; }
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

// --- Admin: find / edit / delete existing entries ---
// `editingEntryId` is null in "add new word" mode, or holds a row's id while the
// form below is being used to edit that specific row instead of creating a new one.
let editingEntryId = null;
let manageSearchSeq = 0;

async function searchManage() {
    const raw = document.getElementById('manageSearchInput').value.trim();
    const resultsEl = document.getElementById('manageResults');
    const mySeq = ++manageSearchSeq;

    if (!raw) {
        resultsEl.innerHTML = '';
        return;
    }

    const safeQ = escapeForSupabaseFilter(raw.toLowerCase());
    resultsEl.innerHTML = '<p class="manage-empty"><span class="spinner" aria-hidden="true"></span> Searching…</p>';

    try {
        const { data, error } = await supabaseClient
            .from('dictionary')
            .select('*')
            .eq('language', LANGUAGE)
            .ilike('english_word', `%${safeQ}%`)
            .order('english_word', { ascending: true })
            .limit(25);

        if (mySeq !== manageSearchSeq) return;
        if (error) throw error;

        renderManageResults(data || []);
    } catch (e) {
        if (mySeq !== manageSearchSeq) return;
        resultsEl.innerHTML = '';
        showToast('Search failed: ' + e.message, 'error');
    }
}

function renderManageResults(rows) {
    const resultsEl = document.getElementById('manageResults');
    resultsEl.innerHTML = '';

    if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'manage-empty';
        empty.textContent = 'No matching entries.';
        resultsEl.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'manage-row';

        const textEl = document.createElement('div');
        textEl.className = 'manage-row-text';
        const wordSpan = document.createElement('span');
        wordSpan.className = 'mr-word';
        wordSpan.textContent = row.english_word;
        const transSpan = document.createElement('span');
        transSpan.className = 'mr-translation';
        transSpan.textContent = row.translation;
        textEl.appendChild(wordSpan);
        textEl.appendChild(transSpan);
        if (row.extra_info) {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'mr-tag';
            tagSpan.textContent = row.extra_info;
            textEl.appendChild(tagSpan);
        }

        const actions = document.createElement('div');
        actions.className = 'manage-row-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'copy-btn-mini';
        editBtn.innerHTML = '<svg width="13" height="13"><use href="#icon-edit"/></svg>';
        editBtn.setAttribute('aria-label', `Edit ${row.english_word}`);
        editBtn.onclick = () => startEdit(row);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'copy-btn-mini manage-delete-btn';
        deleteBtn.innerHTML = '<svg width="13" height="13"><use href="#icon-trash"/></svg>';
        deleteBtn.setAttribute('aria-label', `Delete ${row.english_word}`);
        deleteBtn.onclick = () => deleteEntry(row);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        rowEl.appendChild(textEl);
        rowEl.appendChild(actions);
        resultsEl.appendChild(rowEl);
    });
}

function startEdit(row) {
    editingEntryId = row.id;
    document.getElementById('newEnglish').value = row.english_word;
    document.getElementById('newTranslation').value = row.translation;
    document.getElementById('newType').value = row.extra_info || '';

    document.getElementById('entryFormHeading').textContent = `Editing "${row.english_word}"`;
    document.getElementById('saveEntryBtn').textContent = 'Update entry';
    document.getElementById('cancelEditBtn').style.display = 'block';
    document.getElementById('newEnglish').focus();
}

function cancelEdit() {
    editingEntryId = null;
    document.getElementById('newEnglish').value = '';
    document.getElementById('newTranslation').value = '';
    document.getElementById('newType').value = '';

    document.getElementById('entryFormHeading').textContent = 'Add a new word';
    document.getElementById('saveEntryBtn').textContent = 'Save entry';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function saveWord() {
    const btn = document.getElementById('saveEntryBtn');
    const english_word = document.getElementById('newEnglish').value.trim();
    const translation = document.getElementById('newTranslation').value.trim();
    const extra_info = document.getElementById('newType').value.trim();

    if (!english_word || !translation) {
        showToast('English word and Malayalam translation are required', 'error');
        return;
    }

    setButtonLoading(btn, true);
    try {
        if (editingEntryId !== null) {
            // Edit mode — update the specific row being edited
            const { error } = await supabaseClient
                .from('dictionary')
                .update({ english_word, translation, extra_info })
                .eq('id', editingEntryId);
            if (error) throw error;

            showToast('Entry updated', 'success');
            cancelEdit();
            searchManage(); // refresh the find-results list so the edit is reflected
        } else {
            // Add mode — insert a brand new row
            const { error } = await supabaseClient
                .from('dictionary')
                .insert([{ language: LANGUAGE, english_word, translation, extra_info }]);
            if (error) throw error;

            showToast('Saved successfully', 'success');
            document.getElementById('newEnglish').value = '';
            document.getElementById('newTranslation').value = '';
            document.getElementById('newType').value = '';
            document.getElementById('newEnglish').focus();
        }

        safeStore.remove('localStorage', 'wotd_cache'); // dictionary changed — don't serve a stale Word of the Day
    } catch (e) {
        showToast((editingEntryId !== null ? 'Update failed: ' : 'Save failed: ') + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function deleteEntry(row) {
    const ok = window.confirm(`Delete "${row.english_word} → ${row.translation}"? This can't be undone.`);
    if (!ok) return;

    try {
        const { error } = await supabaseClient
            .from('dictionary')
            .delete()
            .eq('id', row.id);
        if (error) throw error;

        showToast('Entry deleted', 'success');
        if (editingEntryId === row.id) cancelEdit();
        safeStore.remove('localStorage', 'wotd_cache');
        searchManage(); // refresh the list
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
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
    cancelEdit();
    document.getElementById('manageSearchInput').value = '';
    document.getElementById('manageResults').innerHTML = '';
}

// --- Restore saved theme before first interaction ---
if (safeStore.get('localStorage', 'dict_theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

// --- Event wiring ---
on('searchInput', 'input', handleSearchInput);
on('searchInput', 'keydown', (e) => {
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

on('backButton', 'click', () => {
    closePanel('descriptionArea');
    openPanel('bookTableContainer');
});

on('refreshBtn', 'click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spin-once');
    setTimeout(() => btn.classList.remove('spin-once'), 650);
    init();
});

on('themeToggle', 'click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    safeStore.set('localStorage', 'dict_theme', isDark ? 'dark' : 'light');
});

on('adminLoginBtn', 'click', () => {
    if (isPanelOpen('adminPanel')) {
        closePanel('adminPanel', 'adminLoginBtn');
    } else {
        closePanel('contactArea', 'contactButton');
        openPanel('adminPanel', 'adminLoginBtn');
    }
});

on('contactButton', 'click', () => {
    if (isPanelOpen('contactArea')) {
        closePanel('contactArea', 'contactButton');
    } else {
        closePanel('adminPanel', 'adminLoginBtn');
        openPanel('contactArea', 'contactButton');
    }
});

on('adminPass', 'keydown', (e) => {
    if (e.key === 'Enter') performLogin();
});

on('manageSearchBtn', 'click', () => searchManage());
on('manageSearchInput', 'keydown', (e) => {
    if (e.key === 'Enter') searchManage();
});

on('wotdClose', 'click', () => {
    document.getElementById('wordOfDay').style.display = 'none';
    safeStore.set('sessionStorage', 'wotd_dismissed', todayKey());
});

safeRun(init);
safeRun(loadWordOfDay);
