// Supabase Configuration 
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentLanguage = "MALAYALAM";
let searchTimeout = null;

async function init() {
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = `✅ Connected to ${currentLanguage}`;
    document.getElementById('bookTableContainer').style.display = 'none';
    document.getElementById('searchInput').value = '';
    
    // Check if admin is already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('entryForm').style.display = 'block';
    }
}

// Live Search with Supabase
async function filterData(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('bookTableContainer');
    const status = document.getElementById('statusMessage');
    
    if (!q) { 
        if (container) container.style.display = 'none'; 
        status.textContent = "✅ Ready!";
        return; 
    }

    status.textContent = "🔍 Searching...";

    try {
        // Query Supabase directly
        const { data, error } = await supabase
            .from('dictionary')
            .select('*')
            .eq('language', currentLanguage)
            .ilike('english_word', `%${q}%`)
            .limit(50); // Fetch top 50 matches for performance

        if (error) throw error;

        // Group results by English word
        const groupedData = {};
        data.forEach(item => {
            if (!groupedData[item.english_word]) groupedData[item.english_word] = [];
            groupedData[item.english_word].push(item);
        });

        // Sort exact matches to top
        const matches = Object.keys(groupedData).sort((a, b) => {
            const aLow = a.toLowerCase();
            const bLow = b.toLowerCase();
            if (aLow === q && bLow !== q) return -1;
            if (bLow === q && aLow !== q) return 1;
            if (aLow.startsWith(q) && !bLow.startsWith(q)) return -1;
            if (bLow.startsWith(q) && !aLow.startsWith(q)) return 1;
            return aLow.localeCompare(bLow);
        });

        renderTable(matches, groupedData, q);
        status.textContent = "✅ Ready!";
    } catch (e) {
        status.textContent = "⚠️ Search Error.";
        console.error("Fetch error:", e);
    }
}

// Debounce search to prevent making too many requests while typing
function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterData(e.target.value), 300);
}

function renderTable(matchingKeys, groupedData, query) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    if (!tbody) return;

    tbody.innerHTML = ''; 

    if (matchingKeys.length === 0) { 
        container.style.display = 'none'; 
        const status = document.getElementById('statusMessage');
        status.textContent = "No results found.";
        return; 
    }

    container.style.display = 'block';
    
    matchingKeys.forEach(word => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(word, groupedData[word]);
        
        if(word.toLowerCase() === query) {
            row.className = "exact-match-row";
        }

        const cellEng = row.insertCell();
        cellEng.textContent = word;
        cellEng.style.fontWeight = "bold";
        
        const cellTr = row.insertCell();
        const allMeanings = groupedData[word].map(item => item.translation);
        cellTr.textContent = allMeanings.join(", ");
    });
}

function showDetails(word, entries) {
    document.getElementById('bookTableContainer').style.display = 'none';
    let html = '';
    entries.forEach(e => {
        let tagLabel = (currentLanguage === "MALAYALAM") ? "Grammar" : "Transliteration";
        html += `
            <div class="detail-item">
                <p style="font-size: 1.25rem; margin:0; font-weight: 600; color: var(--primary-color);">
                    ${e.translation} 
                    <button onclick="navigator.clipboard.writeText('${e.translation}')" class="copy-btn-mini">📋</button>
                </p>
                ${e.extra_info ? `<p style="font-size: 0.85rem; color: #777; margin: 4px 0;"><em>${tagLabel}:${e.extra_info}</em></p>` : ''}
                ${e.explanation ? `<p class="explanation-box"><strong>Explanation:</strong> ${e.explanation}</p>` : ''}
            </div>
        `;
    });
    document.getElementById('definitionText').innerHTML = html;
    document.getElementById('descriptionTitle').textContent = word;
    document.getElementById('descriptionArea').style.display = 'block';
}

// Supabase Admin Auth
async function performLogin() {
    const email = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass
        });
        
        if(error) throw error;
        
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('entryForm').style.display = 'block';
        alert("Login Successful");
    } catch(e) { 
        alert("Login Failed: " + e.message); 
    }
}

async function saveNewWord() {
    const english_word = document.getElementById('newEnglish').value;
    const translation = document.getElementById('newTranslation').value;
    const extra_info = document.getElementById('newType').value; 
    
    try {
        const { data, error } = await supabase
            .from('dictionary')
            .insert([
                { 
                    language: currentLanguage, 
                    english_word: english_word, 
                    translation: translation, 
                    extra_info: extra_info 
                }
            ]);
            
        if (error) throw error;
        
        alert("Saved successfully!");
        document.getElementById('newEnglish').value = '';
        document.getElementById('newTranslation').value = '';
        document.getElementById('newType').value = '';
    } catch(e) { 
        alert("Save failed: " + e.message); 
    }
}

async function logout() {
    await supabase.auth.signOut();
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
}

// Events
document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
document.getElementById('searchInput').oninput = handleSearchInput;
document.getElementById('backButton').onclick = () => { 
    document.getElementById('descriptionArea').style.display='none'; 
    document.getElementById('bookTableContainer').style.display = 'block'; 
};
document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');
document.getElementById('adminLoginBtn').onclick = () => { 
    const p = document.getElementById('adminPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('contactButton').onclick = () => {
    const c = document.getElementById('contactArea');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
};

init();
