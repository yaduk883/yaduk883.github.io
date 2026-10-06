// --- Supabase Configuration ---
// Same project as the dictionary — an admin who is already signed in on index.html
// will also be signed in here automatically (Supabase persists the session in
// localStorage), and vice versa.
const supabaseUrl = 'https://plwtfwylrlintbnvhfha.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsd3Rmd3lscmxpbnRibnZoZmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjIxODQsImV4cCI6MjEwNTYzODE4NH0.Y65Dhadml3pFMyytXro0drSprdYY-IOr4jQJ3tfL3F8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Shared helpers (same approach as script.js: escape everything, never trust DB content) ---
function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeForSupabaseFilter(str) {
    return str.replace(/[%_,()\\]/g, '\\$&');
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

function openPanel(id) { document.getElementById(id).classList.add('is-open'); }
function closePanel(id) { document.getElementById(id).classList.remove('is-open'); }
function isPanelOpen(id) { return document.getElementById(id).classList.contains('is-open'); }

const CATEGORY_LABELS = {
    parts_of_speech: 'Parts of speech',
    articles: 'Articles',
    tenses: 'Tenses',
    verb_forms: 'Verb forms',
    sentence_structure: 'Sentence structure',
    other: 'Grammar basics'
};

// Appends a small Malayalam explanation line under some English content —
// but only when one actually exists, so untranslated content shows nothing
// extra rather than an empty box.
function appendMl(parent, mlText) {
    if (!mlText) return;
    const p = document.createElement('p');
    p.className = 'gr-ml';
    p.textContent = mlText;
    parent.appendChild(p);
}

const TAG_LABELS = {
    affirmative: 'Affirm.',
    negative: 'Neg.',
    question: 'Question',
    example: 'Example',
    correct: 'Correct',
    incorrect: 'Incorrect',
    note: 'Note'
};

function tagLabel(type) {
    if (TAG_LABELS[type]) return TAG_LABELS[type];
    if (!type) return '';
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function slugify(text) {
    return (text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* =========================================================================
   PUBLIC CONTENT — fetches grammar_guide, groups it, and renders it using
   three bespoke layouts (parts-of-speech grid / article cards / tense cards)
   so the page keeps looking the way it always has, even though the content
   now lives in Supabase. Any category beyond those three (sentence_structure,
   other, or anything added later) falls back to a general-purpose card style
   that reuses the same visual language rather than looking unstyled.
   ========================================================================= */

async function loadGrammar() {
    const container = document.getElementById('grammarContent');
    const toc = document.getElementById('grammarTOC');

    try {
        const { data, error } = await supabaseClient
            .from('grammar_guide')
            .select('*')
            .order('topic_order', { ascending: true })
            .order('rule_order', { ascending: true })
            .order('example_order', { ascending: true });

        if (error) throw error;

        const { topics, rules, examples } = groupGrammarRows(data || []);
        renderGrammar(topics, rules, examples, container, toc);
    } catch (e) {
        console.error('Failed to load grammar:', e);
        container.innerHTML = '';
        const errBox = document.createElement('div');
        errBox.className = 'gr-error';
        const strong = document.createElement('strong');
        strong.textContent = 'Unable to load grammar.';
        const p = document.createElement('p');
        p.style.margin = '6px 0 0';
        p.textContent = e.message || 'Please try again later.';
        errBox.appendChild(strong);
        errBox.appendChild(p);
        container.appendChild(errBox);
        toc.innerHTML = '';
    }
}

function groupGrammarRows(data) {
    const topics = [];
    const topicMap = new Map();
    const rulesMap = new Map();
    const examplesSeen = new Set();
    const rules = [];
    const examples = [];

    data.forEach(row => {
        if (!topicMap.has(row.topic_id)) {
            const topic = {
                topic_id: row.topic_id,
                slug: row.slug,
                category: row.category,
                title: row.title,
                short_description: row.short_description,
                short_description_ml: row.short_description_ml,
                formula: row.formula,
                topic_order: row.topic_order
            };
            topicMap.set(row.topic_id, topic);
            topics.push(topic);
        }
        if (row.rule_id && !rulesMap.has(row.rule_id)) {
            const rule = {
                topic_id: row.topic_id,
                rule_id: row.rule_id,
                rule_number: row.rule_number,
                rule_title: row.rule_title,
                rule_text: row.rule_text,
                rule_text_ml: row.rule_text_ml,
                notes: row.notes,
                notes_ml: row.notes_ml,
                rule_order: row.rule_order
            };
            rulesMap.set(row.rule_id, rule);
            rules.push(rule);
        }
        if (row.example_id && !examplesSeen.has(row.example_id)) {
            examplesSeen.add(row.example_id);
            examples.push({
                example_id: row.example_id,
                topic_id: row.topic_id,
                rule_id: row.rule_id,
                example_type: row.example_type,
                sentence: row.sentence,
                explanation: row.explanation,
                explanation_ml: row.explanation_ml,
                example_order: row.example_order
            });
        }
    });

    return { topics, rules, examples };
}

function renderGrammar(topics, rules, examples, container, toc) {
    container.innerHTML = '';
    toc.innerHTML = '';

    const byCategory = {};
    topics.forEach(t => {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t);
    });

    const tocEntries = [];

    if (byCategory.parts_of_speech && byCategory.parts_of_speech.length) {
        container.appendChild(renderPartsOfSpeech(byCategory.parts_of_speech, rules, examples));
        tocEntries.push({ id: 'parts-of-speech', label: 'Parts of speech' });
    }

    if (byCategory.articles && byCategory.articles.length) {
        container.appendChild(renderArticles(byCategory.articles, rules, examples));
        tocEntries.push({ id: 'articles', label: 'Articles' });
    }

    if (byCategory.tenses && byCategory.tenses.length) {
        const groups = [
            { prefix: 'present_', id: 'present-tenses', label: 'Present tenses', heading: 'Present tenses', intro: 'Four ways to talk about now, habits, or things that connect the past to the present.' },
            { prefix: 'past_', id: 'past-tenses', label: 'Past tenses', heading: 'Past tenses', intro: 'Four ways to talk about something that already happened.' },
            { prefix: 'future_', id: 'future-tenses', label: 'Future tenses', heading: 'Future tenses', intro: "Four ways to talk about what hasn't happened yet." }
        ];
        groups.forEach(g => {
            const groupTopics = byCategory.tenses
                .filter(t => (t.slug || '').startsWith(g.prefix))
                .sort((a, b) => a.topic_order - b.topic_order);
            if (groupTopics.length) {
                container.appendChild(renderTenseGroup(g, groupTopics, rules, examples));
                tocEntries.push({ id: g.id, label: g.label });
            }
        });

        // Any tense-category topic that doesn't match present_/past_/future_
        // (e.g. conditionals added later) still needs somewhere to go.
        const leftover = byCategory.tenses.filter(t => !['present_', 'past_', 'future_'].some(p => (t.slug || '').startsWith(p)));
        if (leftover.length) {
            container.appendChild(renderGenericCategory('tenses-other', 'More tenses', leftover, rules, examples));
            tocEntries.push({ id: 'tenses-other', label: 'More tenses' });
        }
    }

    Object.keys(byCategory).forEach(cat => {
        if (['parts_of_speech', 'articles', 'tenses'].includes(cat)) return;
        const label = CATEGORY_LABELS[cat] || cat;
        const id = slugify(cat);
        container.appendChild(renderGenericCategory(id, label, byCategory[cat], rules, examples));
        tocEntries.push({ id, label });
    });

    if (topics.length === 0) {
        container.innerHTML = '<p class="gr-loading">No grammar content has been added yet.</p>';
        return;
    }

    tocEntries.forEach(entry => {
        const a = document.createElement('a');
        a.href = `#${entry.id}`;
        a.textContent = entry.label;
        toc.appendChild(a);
    });
}

function renderPartsOfSpeech(topicList, rules, examples) {
    const section = document.createElement('section');
    section.id = 'parts-of-speech';
    section.className = 'gr-section';

    const h2 = document.createElement('h2');
    h2.className = 'gr-section-title';
    h2.textContent = 'Parts of speech';
    section.appendChild(h2);

    const intro = document.createElement('p');
    intro.className = 'gr-section-intro';
    intro.textContent = "Every English word plays one of these roles in a sentence. Knowing them makes every other grammar rule — including the tenses below — much easier to follow.";
    section.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'gr-pos-grid';

    topicList.sort((a, b) => a.topic_order - b.topic_order).forEach(topic => {
        const card = document.createElement('div');
        card.className = 'gr-pos-card';

        const name = document.createElement('h3');
        name.className = 'gr-pos-name';
        name.textContent = topic.title;

        const def = document.createElement('p');
        def.className = 'gr-pos-def';
        def.textContent = topic.short_description || '';

        card.appendChild(name);
        card.appendChild(def);
        appendMl(card, topic.short_description_ml);

        const example = examples.find(e => e.topic_id === topic.topic_id);
        if (example) {
            const exP = document.createElement('p');
            exP.className = 'gr-pos-example';
            exP.textContent = example.sentence;
            card.appendChild(exP);
        }

        grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
}

function renderArticles(topicList, rules, examples) {
    const section = document.createElement('section');
    section.id = 'articles';
    section.className = 'gr-section';

    const h2 = document.createElement('h2');
    h2.className = 'gr-section-title';
    h2.textContent = 'Articles';
    section.appendChild(h2);

    const intro = document.createElement('p');
    intro.className = 'gr-section-intro';
    intro.textContent = "English articles decide whether a noun is being introduced for the first time or is already known to the listener.";
    section.appendChild(intro);

    topicList.sort((a, b) => a.topic_order - b.topic_order).forEach(topic => {
        const card = document.createElement('div');
        card.className = 'gr-article-card';

        const name = document.createElement('h3');
        name.className = 'gr-article-name';
        name.textContent = topic.title;
        card.appendChild(name);

        if (topic.formula) {
            const formula = document.createElement('div');
            formula.className = 'gr-tense-structure';
            formula.style.marginBottom = '10px';
            formula.textContent = topic.formula;
            card.appendChild(formula);
        }

        if (topic.short_description) {
            const rule = document.createElement('p');
            rule.className = 'gr-article-rule';
            rule.textContent = topic.short_description;
            card.appendChild(rule);
            appendMl(card, topic.short_description_ml);
        }

        const topicExamples = examples.filter(e => e.topic_id === topic.topic_id);
        if (topicExamples.length) {
            const ul = document.createElement('ul');
            ul.className = 'gr-example-list';
            topicExamples.forEach(ex => {
                const li = document.createElement('li');
                li.textContent = ex.sentence;
                appendMl(li, ex.explanation_ml);
                ul.appendChild(li);
            });
            card.appendChild(ul);
        }

        section.appendChild(card);
    });

    return section;
}

function renderTenseGroup(group, topicList, rules, examples) {
    const section = document.createElement('section');
    section.id = group.id;
    section.className = 'gr-section';

    const h2 = document.createElement('h2');
    h2.className = 'gr-section-title';
    h2.textContent = group.heading;
    section.appendChild(h2);

    const intro = document.createElement('p');
    intro.className = 'gr-section-intro';
    intro.textContent = group.intro;
    section.appendChild(intro);

    topicList.forEach(topic => {
        section.appendChild(renderTenseCard(topic, examples));
    });

    return section;
}

function renderTenseCard(topic, examples) {
    const card = document.createElement('div');
    card.className = 'gr-tense-card';

    const name = document.createElement('h3');
    name.className = 'gr-tense-name';
    name.textContent = topic.title;
    card.appendChild(name);

    if (topic.formula) {
        const formula = document.createElement('span');
        formula.className = 'gr-tense-structure';
        formula.textContent = topic.formula;
        card.appendChild(formula);
    }

    const topicExamples = examples
        .filter(e => e.topic_id === topic.topic_id)
        .sort((a, b) => a.example_order - b.example_order);

    if (topicExamples.length) {
        const ul = document.createElement('ul');
        ul.className = 'gr-tense-examples';
        topicExamples.forEach(ex => {
            const li = document.createElement('li');
            const row = document.createElement('div');
            row.className = 'gr-example-row';
            const tag = document.createElement('span');
            tag.className = 'gr-tag';
            tag.textContent = tagLabel(ex.example_type);
            const text = document.createElement('span');
            text.textContent = ex.sentence;
            row.appendChild(tag);
            row.appendChild(text);
            li.appendChild(row);
            appendMl(li, ex.explanation_ml);
            ul.appendChild(li);
        });
        card.appendChild(ul);
    }

    return card;
}

// Fallback for categories without a bespoke layout (sentence_structure, other,
// or anything added later) — shows every rule under each topic, with its
// examples, using the same tense-card visual language.
function renderGenericCategory(id, label, topicList, rules, examples) {
    const section = document.createElement('section');
    section.id = id;
    section.className = 'gr-section';

    const h2 = document.createElement('h2');
    h2.className = 'gr-section-title';
    h2.textContent = label;
    section.appendChild(h2);

    topicList.sort((a, b) => a.topic_order - b.topic_order).forEach(topic => {
        const card = document.createElement('div');
        card.className = 'gr-tense-card';

        const name = document.createElement('h3');
        name.className = 'gr-tense-name';
        name.textContent = topic.title;
        card.appendChild(name);

        if (topic.short_description) {
            const intro = document.createElement('p');
            intro.className = 'gr-section-intro';
            intro.style.marginBottom = '10px';
            intro.textContent = topic.short_description;
            card.appendChild(intro);
            appendMl(card, topic.short_description_ml);
        }

        if (topic.formula) {
            const formula = document.createElement('span');
            formula.className = 'gr-tense-structure';
            formula.textContent = topic.formula;
            card.appendChild(formula);
        }

        const topicRules = rules.filter(r => r.topic_id === topic.topic_id).sort((a, b) => a.rule_order - b.rule_order);
        topicRules.forEach(rule => {
            if (rule.rule_title) {
                const rt = document.createElement('p');
                rt.style.margin = '12px 0 2px';
                rt.style.fontWeight = '600';
                rt.textContent = rule.rule_title;
                card.appendChild(rt);
            }
            const rtext = document.createElement('p');
            rtext.style.margin = '0 0 6px';
            rtext.style.color = 'var(--ink-soft)';
            rtext.style.fontSize = '0.9rem';
            rtext.textContent = rule.rule_text;
            card.appendChild(rtext);
            appendMl(card, rule.rule_text_ml);

            if (rule.notes) {
                const notesP = document.createElement('p');
                notesP.className = 'gr-rule-notes';
                notesP.textContent = rule.notes;
                card.appendChild(notesP);
                appendMl(card, rule.notes_ml);
            }

            const ruleExamples = examples
                .filter(e => e.rule_id === rule.rule_id)
                .sort((a, b) => a.example_order - b.example_order);
            if (ruleExamples.length) {
                const ul = document.createElement('ul');
                ul.className = 'gr-tense-examples';
                ruleExamples.forEach(ex => {
                    const li = document.createElement('li');
                    const row = document.createElement('div');
                    row.className = 'gr-example-row';
                    const tag = document.createElement('span');
                    tag.className = 'gr-tag';
                    tag.textContent = tagLabel(ex.example_type);
                    const text = document.createElement('span');
                    text.textContent = ex.sentence;
                    row.appendChild(tag);
                    row.appendChild(text);
                    li.appendChild(row);
                    if (ex.explanation) {
                        const expP = document.createElement('p');
                        expP.style.margin = '4px 0 0';
                        expP.style.fontSize = '0.82rem';
                        expP.style.color = 'var(--ink-soft)';
                        expP.textContent = ex.explanation;
                        li.appendChild(expP);
                    }
                    appendMl(li, ex.explanation_ml);
                    ul.appendChild(li);
                });
                card.appendChild(ul);
            }
        });

        section.appendChild(card);
    });

    return section;
}

/* =========================================================================
   ADMIN — login/logout + full add/edit/delete for topics, rules, examples.
   Same account and session as the dictionary admin panel (shared Supabase
   Auth session via localStorage).
   ========================================================================= */

let editingTopicId = null;
let editingRuleId = null;
let editingExampleId = null;

async function adminInit() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const loggedIn = !!session;
        document.getElementById('loginForm').style.display = loggedIn ? 'none' : 'block';
        document.getElementById('entryForm').style.display = loggedIn ? 'block' : 'none';
        if (loggedIn) {
            await refreshTopicDropdowns();
        }
    } catch (e) {
        console.error('Session check failed:', e);
    }
}

async function performLogin() {
    const btn = document.getElementById('loginBtn');
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
        await refreshTopicDropdowns();
    } catch (e) {
        showToast('Login failed: ' + e.message, 'error');
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
    closePanel('adminPanel');
    document.getElementById('adminLoginBtn').setAttribute('aria-expanded', 'false');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('adminPass').value = '';
    cancelTopicEdit();
    cancelRuleEdit();
    cancelExampleEdit();
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.gr-admin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.gr-admin-panel').forEach(panel => {
        panel.style.display = panel.id === `tab-${tabName}` ? 'block' : 'none';
    });
}

// --- Shared: topic dropdowns used by the Rules and Examples tabs ---
async function refreshTopicDropdowns() {
    try {
        const { data, error } = await supabaseClient
            .from('grammar_topics')
            .select('id, slug, title, category')
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true });
        if (error) throw error;

        const options = (data || [])
            .map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.title)} (${escapeHTML(t.slug)})</option>`)
            .join('');

        const ruleSelect = document.getElementById('ruleTopicSelect');
        const exTopicSelect = document.getElementById('exampleTopicSelect');
        ruleSelect.innerHTML = options;
        exTopicSelect.innerHTML = options;

        await refreshRuleDropdownForExamples();
    } catch (e) {
        showToast('Could not load topics: ' + e.message, 'error');
    }
}

async function refreshRuleDropdownForExamples() {
    const topicId = document.getElementById('exampleTopicSelect').value;
    const ruleSelect = document.getElementById('exampleRuleSelect');
    if (!topicId) { ruleSelect.innerHTML = ''; return; }

    try {
        const { data, error } = await supabaseClient
            .from('grammar_rules')
            .select('id, rule_number, title')
            .eq('topic_id', topicId)
            .order('sort_order', { ascending: true });
        if (error) throw error;

        ruleSelect.innerHTML = (data || [])
            .map(r => `<option value="${escapeHTML(r.id)}">${r.rule_number}. ${escapeHTML(r.title || 'Rule')}</option>`)
            .join('');
    } catch (e) {
        showToast('Could not load rules: ' + e.message, 'error');
    }
}

/* ---------------------------- TOPICS CRUD ---------------------------- */

async function searchTopics() {
    const raw = document.getElementById('topicSearchInput').value.trim();
    const resultsEl = document.getElementById('topicResults');
    if (!raw) { resultsEl.innerHTML = ''; return; }

    const safeQ = escapeForSupabaseFilter(raw.toLowerCase());
    resultsEl.innerHTML = '<p class="manage-empty"><span class="spinner" aria-hidden="true"></span> Searching…</p>';

    try {
        const { data, error } = await supabaseClient
            .from('grammar_topics')
            .select('*')
            .or(`title.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`)
            .order('sort_order', { ascending: true })
            .limit(25);
        if (error) throw error;
        renderTopicResults(data || []);
    } catch (e) {
        resultsEl.innerHTML = '';
        showToast('Search failed: ' + e.message, 'error');
    }
}

function renderTopicResults(rows) {
    const resultsEl = document.getElementById('topicResults');
    resultsEl.innerHTML = '';
    if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'manage-empty';
        empty.textContent = 'No matching topics.';
        resultsEl.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'manage-row';

        const textEl = document.createElement('div');
        textEl.className = 'manage-row-text';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'mr-word';
        nameSpan.textContent = row.title;
        const tagSpan = document.createElement('span');
        tagSpan.className = 'mr-tag';
        tagSpan.textContent = `${row.category} · ${row.slug}`;
        textEl.appendChild(nameSpan);
        textEl.appendChild(tagSpan);

        const actions = document.createElement('div');
        actions.className = 'manage-row-actions';
        const editBtn = makeIconButton('icon-edit', `Edit ${row.title}`, () => startTopicEdit(row));
        const deleteBtn = makeIconButton('icon-trash', `Delete ${row.title}`, () => deleteTopic(row), true);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        rowEl.appendChild(textEl);
        rowEl.appendChild(actions);
        resultsEl.appendChild(rowEl);
    });
}

function makeIconButton(iconId, ariaLabel, onClick, isDelete) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isDelete ? 'copy-btn-mini manage-delete-btn' : 'copy-btn-mini';
    btn.innerHTML = `<svg width="13" height="13"><use href="#${iconId}"/></svg>`;
    btn.setAttribute('aria-label', ariaLabel);
    btn.onclick = onClick;
    return btn;
}

function startTopicEdit(row) {
    editingTopicId = row.id;
    document.getElementById('topicSlug').value = row.slug;
    document.getElementById('topicCategory').value = row.category;
    document.getElementById('topicTitle').value = row.title;
    document.getElementById('topicDescription').value = row.short_description || '';
    document.getElementById('topicDescriptionMl').value = row.short_description_ml || '';
    document.getElementById('topicFormula').value = row.formula || '';
    document.getElementById('topicSortOrder').value = row.sort_order;
    document.getElementById('topicFormHeading').textContent = `Editing "${row.title}"`;
    document.getElementById('saveTopicBtn').textContent = 'Update topic';
    document.getElementById('cancelTopicBtn').style.display = 'block';
}

function cancelTopicEdit() {
    editingTopicId = null;
    document.getElementById('topicSlug').value = '';
    document.getElementById('topicCategory').value = 'parts_of_speech';
    document.getElementById('topicTitle').value = '';
    document.getElementById('topicDescription').value = '';
    document.getElementById('topicDescriptionMl').value = '';
    document.getElementById('topicFormula').value = '';
    document.getElementById('topicSortOrder').value = 0;
    document.getElementById('topicFormHeading').textContent = 'Add a new topic';
    document.getElementById('saveTopicBtn').textContent = 'Save topic';
    document.getElementById('cancelTopicBtn').style.display = 'none';
}

async function saveTopic() {
    const btn = document.getElementById('saveTopicBtn');
    const slug = document.getElementById('topicSlug').value.trim();
    const category = document.getElementById('topicCategory').value;
    const title = document.getElementById('topicTitle').value.trim();
    const short_description = document.getElementById('topicDescription').value.trim();
    const short_description_ml = document.getElementById('topicDescriptionMl').value.trim();
    const formula = document.getElementById('topicFormula').value.trim();
    const sort_order = parseInt(document.getElementById('topicSortOrder').value, 10) || 0;

    if (!slug || !title) {
        showToast('Slug and title are required', 'error');
        return;
    }

    setButtonLoading(btn, true);
    try {
        if (editingTopicId !== null) {
            const { error } = await supabaseClient
                .from('grammar_topics')
                .update({ slug, category, title, short_description, short_description_ml, formula, sort_order })
                .eq('id', editingTopicId);
            if (error) throw error;
            showToast('Topic updated', 'success');
        } else {
            const { error } = await supabaseClient
                .from('grammar_topics')
                .insert([{ slug, category, title, short_description, short_description_ml, formula, sort_order }]);
            if (error) throw error;
            showToast('Topic added', 'success');
        }
        cancelTopicEdit();
        searchTopics();
        refreshTopicDropdowns();
        loadGrammar();
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function deleteTopic(row) {
    const ok = window.confirm(`Delete topic "${row.title}"? This also deletes all its rules and examples. This can't be undone.`);
    if (!ok) return;

    try {
        const { error } = await supabaseClient.from('grammar_topics').delete().eq('id', row.id);
        if (error) throw error;
        showToast('Topic deleted', 'success');
        if (editingTopicId === row.id) cancelTopicEdit();
        searchTopics();
        refreshTopicDropdowns();
        loadGrammar();
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
}

/* ---------------------------- RULES CRUD ---------------------------- */

async function listRulesForTopic() {
    const topicId = document.getElementById('ruleTopicSelect').value;
    const resultsEl = document.getElementById('ruleResults');
    if (!topicId) { resultsEl.innerHTML = ''; return; }

    resultsEl.innerHTML = '<p class="manage-empty"><span class="spinner" aria-hidden="true"></span> Loading…</p>';
    try {
        const { data, error } = await supabaseClient
            .from('grammar_rules')
            .select('*')
            .eq('topic_id', topicId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        renderRuleResults(data || []);
    } catch (e) {
        resultsEl.innerHTML = '';
        showToast('Could not load rules: ' + e.message, 'error');
    }
}

function renderRuleResults(rows) {
    const resultsEl = document.getElementById('ruleResults');
    resultsEl.innerHTML = '';
    if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'manage-empty';
        empty.textContent = 'No rules yet for this topic.';
        resultsEl.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'manage-row';

        const textEl = document.createElement('div');
        textEl.className = 'manage-row-text';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'mr-word';
        nameSpan.textContent = `${row.rule_number}. ${row.title || 'Rule'}`;
        const transSpan = document.createElement('span');
        transSpan.className = 'mr-translation';
        transSpan.textContent = row.rule_text;
        textEl.appendChild(nameSpan);
        textEl.appendChild(transSpan);

        const actions = document.createElement('div');
        actions.className = 'manage-row-actions';
        const editBtn = makeIconButton('icon-edit', `Edit rule ${row.rule_number}`, () => startRuleEdit(row));
        const deleteBtn = makeIconButton('icon-trash', `Delete rule ${row.rule_number}`, () => deleteRule(row), true);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        rowEl.appendChild(textEl);
        rowEl.appendChild(actions);
        resultsEl.appendChild(rowEl);
    });
}

function startRuleEdit(row) {
    editingRuleId = row.id;
    document.getElementById('ruleTopicSelect').value = row.topic_id;
    document.getElementById('ruleNumber').value = row.rule_number;
    document.getElementById('ruleTitle').value = row.title || '';
    document.getElementById('ruleText').value = row.rule_text;
    document.getElementById('ruleTextMl').value = row.rule_text_ml || '';
    document.getElementById('ruleNotes').value = row.notes || '';
    document.getElementById('ruleNotesMl').value = row.notes_ml || '';
    document.getElementById('ruleSortOrder').value = row.sort_order;
    document.getElementById('ruleFormHeading').textContent = `Editing rule ${row.rule_number}`;
    document.getElementById('saveRuleBtn').textContent = 'Update rule';
    document.getElementById('cancelRuleBtn').style.display = 'block';
}

function cancelRuleEdit() {
    editingRuleId = null;
    document.getElementById('ruleNumber').value = 1;
    document.getElementById('ruleTitle').value = '';
    document.getElementById('ruleText').value = '';
    document.getElementById('ruleTextMl').value = '';
    document.getElementById('ruleNotes').value = '';
    document.getElementById('ruleNotesMl').value = '';
    document.getElementById('ruleSortOrder').value = 1;
    document.getElementById('ruleFormHeading').textContent = 'Add a new rule';
    document.getElementById('saveRuleBtn').textContent = 'Save rule';
    document.getElementById('cancelRuleBtn').style.display = 'none';
}

async function saveRule() {
    const btn = document.getElementById('saveRuleBtn');
    const topic_id = document.getElementById('ruleTopicSelect').value;
    const rule_number = parseInt(document.getElementById('ruleNumber').value, 10);
    const title = document.getElementById('ruleTitle').value.trim();
    const rule_text = document.getElementById('ruleText').value.trim();
    const rule_text_ml = document.getElementById('ruleTextMl').value.trim();
    const notes = document.getElementById('ruleNotes').value.trim();
    const notes_ml = document.getElementById('ruleNotesMl').value.trim();
    const sort_order = parseInt(document.getElementById('ruleSortOrder').value, 10) || 0;

    if (!topic_id) { showToast('Choose a topic first', 'error'); return; }
    if (!rule_number || !rule_text) { showToast('Rule number and rule text are required', 'error'); return; }

    setButtonLoading(btn, true);
    try {
        if (editingRuleId !== null) {
            const { error } = await supabaseClient
                .from('grammar_rules')
                .update({ topic_id, rule_number, title, rule_text, rule_text_ml, notes, notes_ml, sort_order })
                .eq('id', editingRuleId);
            if (error) throw error;
            showToast('Rule updated', 'success');
        } else {
            const { error } = await supabaseClient
                .from('grammar_rules')
                .insert([{ topic_id, rule_number, title, rule_text, rule_text_ml, notes, notes_ml, sort_order }]);
            if (error) throw error;
            showToast('Rule added', 'success');
        }
        cancelRuleEdit();
        listRulesForTopic();
        loadGrammar();
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function deleteRule(row) {
    const ok = window.confirm(`Delete rule "${row.rule_number}. ${row.title || ''}"? This also deletes its examples. This can't be undone.`);
    if (!ok) return;

    try {
        const { error } = await supabaseClient.from('grammar_rules').delete().eq('id', row.id);
        if (error) throw error;
        showToast('Rule deleted', 'success');
        if (editingRuleId === row.id) cancelRuleEdit();
        listRulesForTopic();
        loadGrammar();
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
}

/* ---------------------------- EXAMPLES CRUD ---------------------------- */

async function listExamplesForRule() {
    const ruleId = document.getElementById('exampleRuleSelect').value;
    const resultsEl = document.getElementById('exampleResults');
    if (!ruleId) { resultsEl.innerHTML = ''; return; }

    resultsEl.innerHTML = '<p class="manage-empty"><span class="spinner" aria-hidden="true"></span> Loading…</p>';
    try {
        const { data, error } = await supabaseClient
            .from('grammar_examples')
            .select('*')
            .eq('rule_id', ruleId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        renderExampleResults(data || []);
    } catch (e) {
        resultsEl.innerHTML = '';
        showToast('Could not load examples: ' + e.message, 'error');
    }
}

function renderExampleResults(rows) {
    const resultsEl = document.getElementById('exampleResults');
    resultsEl.innerHTML = '';
    if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'manage-empty';
        empty.textContent = 'No examples yet for this rule.';
        resultsEl.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'manage-row';

        const textEl = document.createElement('div');
        textEl.className = 'manage-row-text';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'mr-word';
        nameSpan.textContent = tagLabel(row.example_type);
        const transSpan = document.createElement('span');
        transSpan.className = 'mr-translation';
        transSpan.textContent = row.sentence;
        textEl.appendChild(nameSpan);
        textEl.appendChild(transSpan);

        const actions = document.createElement('div');
        actions.className = 'manage-row-actions';
        const editBtn = makeIconButton('icon-edit', 'Edit example', () => startExampleEdit(row));
        const deleteBtn = makeIconButton('icon-trash', 'Delete example', () => deleteExample(row), true);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        rowEl.appendChild(textEl);
        rowEl.appendChild(actions);
        resultsEl.appendChild(rowEl);
    });
}

function startExampleEdit(row) {
    editingExampleId = row.id;
    document.getElementById('exampleType').value = row.example_type;
    document.getElementById('exampleSentence').value = row.sentence;
    document.getElementById('exampleExplanation').value = row.explanation || '';
    document.getElementById('exampleExplanationMl').value = row.explanation_ml || '';
    document.getElementById('exampleSortOrder').value = row.sort_order;
    document.getElementById('exampleFormHeading').textContent = 'Editing example';
    document.getElementById('saveExampleBtn').textContent = 'Update example';
    document.getElementById('cancelExampleBtn').style.display = 'block';
}

function cancelExampleEdit() {
    editingExampleId = null;
    document.getElementById('exampleType').value = 'affirmative';
    document.getElementById('exampleSentence').value = '';
    document.getElementById('exampleExplanation').value = '';
    document.getElementById('exampleExplanationMl').value = '';
    document.getElementById('exampleSortOrder').value = 1;
    document.getElementById('exampleFormHeading').textContent = 'Add a new example';
    document.getElementById('saveExampleBtn').textContent = 'Save example';
    document.getElementById('cancelExampleBtn').style.display = 'none';
}

async function saveExample() {
    const btn = document.getElementById('saveExampleBtn');
    const topic_id = document.getElementById('exampleTopicSelect').value;
    const rule_id = document.getElementById('exampleRuleSelect').value;
    const example_type = document.getElementById('exampleType').value;
    const sentence = document.getElementById('exampleSentence').value.trim();
    const explanation = document.getElementById('exampleExplanation').value.trim();
    const explanation_ml = document.getElementById('exampleExplanationMl').value.trim();
    const sort_order = parseInt(document.getElementById('exampleSortOrder').value, 10) || 0;

    if (!topic_id || !rule_id) { showToast('Choose a topic and rule first', 'error'); return; }
    if (!sentence) { showToast('Sentence is required', 'error'); return; }

    setButtonLoading(btn, true);
    try {
        if (editingExampleId !== null) {
            const { error } = await supabaseClient
                .from('grammar_examples')
                .update({ topic_id, rule_id, example_type, sentence, explanation, explanation_ml, sort_order })
                .eq('id', editingExampleId);
            if (error) throw error;
            showToast('Example updated', 'success');
        } else {
            const { error } = await supabaseClient
                .from('grammar_examples')
                .insert([{ topic_id, rule_id, example_type, sentence, explanation, explanation_ml, sort_order }]);
            if (error) throw error;
            showToast('Example added', 'success');
        }
        cancelExampleEdit();
        listExamplesForRule();
        loadGrammar();
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function deleteExample(row) {
    const ok = window.confirm('Delete this example? This can\'t be undone.');
    if (!ok) return;

    try {
        const { error } = await supabaseClient.from('grammar_examples').delete().eq('id', row.id);
        if (error) throw error;
        showToast('Example deleted', 'success');
        if (editingExampleId === row.id) cancelExampleEdit();
        listExamplesForRule();
        loadGrammar();
    } catch (e) {
        showToast('Delete failed: ' + e.message, 'error');
    }
}

/* ---------------------------- EVENT WIRING ---------------------------- */

document.getElementById('adminLoginBtn').addEventListener('click', () => {
    if (isPanelOpen('adminPanel')) {
        closePanel('adminPanel');
        document.getElementById('adminLoginBtn').setAttribute('aria-expanded', 'false');
    } else {
        openPanel('adminPanel');
        document.getElementById('adminLoginBtn').setAttribute('aria-expanded', 'true');
    }
});

document.getElementById('loginBtn').addEventListener('click', performLogin);
document.getElementById('adminPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') performLogin(); });
document.getElementById('logoutBtn').addEventListener('click', logout);

document.querySelectorAll('.gr-admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
});

document.getElementById('topicSearchBtn').addEventListener('click', searchTopics);
document.getElementById('topicSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTopics(); });
document.getElementById('saveTopicBtn').addEventListener('click', saveTopic);
document.getElementById('cancelTopicBtn').addEventListener('click', cancelTopicEdit);

document.getElementById('ruleListBtn').addEventListener('click', listRulesForTopic);
document.getElementById('ruleTopicSelect').addEventListener('change', () => { cancelRuleEdit(); listRulesForTopic(); });
document.getElementById('saveRuleBtn').addEventListener('click', saveRule);
document.getElementById('cancelRuleBtn').addEventListener('click', cancelRuleEdit);

document.getElementById('exampleTopicSelect').addEventListener('change', () => { cancelExampleEdit(); refreshRuleDropdownForExamples(); document.getElementById('exampleResults').innerHTML = ''; });
document.getElementById('exampleListBtn').addEventListener('click', listExamplesForRule);
document.getElementById('exampleRuleSelect').addEventListener('change', () => { cancelExampleEdit(); listExamplesForRule(); });
document.getElementById('saveExampleBtn').addEventListener('click', saveExample);
document.getElementById('cancelExampleBtn').addEventListener('click', cancelExampleEdit);

loadGrammar();
adminInit();
