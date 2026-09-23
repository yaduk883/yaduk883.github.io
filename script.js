// Supabase Configuration 
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let searchTimeout = null;

async function init() {
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = `✅ Connected to Database`;
    document.getElementById('bookTableContainer').style.display = 'none';
    document.getElementById('descriptionArea').style.display = 'none';
    document.getElementById('searchInput').value = '';
    
    // Check if admin is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('entryForm').style.display = 'block';
    }
}

// Bidirectional Live Search (English <-> Malayalam)
async function filterData(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('bookTableContainer');
    const description = document.getElementById('descriptionArea');
    const status = document.getElementById('statusMessage');
    
    if (!q) { 
        if (container) container.style.display = 'none'; 
        if (description) description.style.display = 'none'; 
        status.textContent = "✅ Ready!";
        return; 
    }

    status.textContent = "🔍 Searching...";
    description.style.display = 'none'; 

    try {
        // Search in both English AND Malayalam columns simultaneously
        const { data, error } = await supabase
            .from('dictionary')
            .select('*')
            .eq('language', 'MALAYALAM')
            .or(`english_word.ilike.%${q}%,translation.ilike.%${q}%`)
            .limit(50); // Fetch top 50 matches

        if (error) throw error;

        // Group results by English word
        const groupedData = {};
        data.forEach(item => {
            if (!groupedData[item.english_word]) groupedData[item.english_word] = [];
            groupedData[item.english_word].push(item);
        });

        // Sort exact matches to the top
        const matches = Object.keys(groupedData).sort((a, b) => {
            const aLow = a.toLowerCase();
            const bLow = b.toLowerCase();
            
            // Check for exact English match
            const aExactEng = aLow === q;
            const bExactEng = bLow === q;
            
            // Check for exact Malayalam match
            const aExactMal = groupedData[a].some(i => i.translation === query);
            const bExactMal = groupedData[b].some(i => i.translation === query);

            if ((aExactEng || aExactMal) && !(bExactEng || bExactMal)) return -1;
            if (!(aExactEng || aExactMal) && (bExactEng || bExactMal)) return 1;

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

// Debounce search
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
    
    // Smooth animation
    container.style.animation = 'none';
    container.offsetHeight; 
    container.style.animation = 'fadeIn 0.4s ease forwards';
    
    matchingKeys.forEach(word => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(word, groupedData[word]);
        
        // Highlight row if English OR Malayalam is an exact match
        const hasExactMalayalam = groupedData[word].some(item => item.translation === query);
        if(word.toLowerCase() === query || hasExactMalayalam) {
            row.className = "exact-match-row";
        }

        const cellEng = row.insertCell();
        cellEng.textContent = word;
        cellEng.style.fontWeight = "600";
        
        const cellTr = row.insertCell();
        const allMeanings = groupedData[word].map(item => item.translation);
        cellTr.textContent = allMeanings.join(", ");
    });
}

function showDetails(word, entries) {
    const tableContainer = document.getElementById('bookTableContainer');
    const descriptionArea = document.getElementById('descriptionArea');
    
    tableContainer.style.display = 'none';
    
    let html = '';
    entries.forEach(e => {
        html += `
            <div class="detail-item">
                <p style="font-size: 1.25rem; margin:0; font-weight: 600; color: var(--primary-color);">
                    ${e.translation} 
                    <button onclick="navigator.clipboard.writeText('${e.translation}')" class="copy-btn-mini" title="Copy to clipboard">📋</button>
                </p>
                ${e.extra_info ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin: 4px 0;"><em>Grammar Tag: ${e.extra_info}</em></p>` : ''}
            </div>
        `;
    });
    
    document.getElementById('definitionText').innerHTML = html;
    document.getElementById('descriptionTitle').textContent = word;
    
    descriptionArea.style.display = 'block';
    
    // Smooth animation
    descriptionArea.style.animation = 'none';
    descriptionArea.offsetHeight; 
    descriptionArea.style.animation = 'fadeIn 0.3s ease forwards';
}

// Supabase Admin Auth
async function performLogin() {
    const email = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    
    if(!email || !pass) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass
        });
        
        if(error) throw error;
        
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('entryForm').style.display = 'block';
        
        document.getElementById('adminUser').value = '';
        document.getElementById('adminPass').value = '';
        
        alert("Login Successful");
    } catch(e) { 
        alert("Login Failed: " + e.message); 
    }
}

async function saveNewWord() {
    const english_word = document.getElementById('newEnglish').value.trim();
    const translation = document.getElementById('newTranslation').value.trim();
    const extra_info = document.getElementById('newType').value.trim(); 
    
    if(!english_word || !translation) {
        alert("English Word and Malayalam Translation are required.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('dictionary')
            .insert([
                { 
                    language: 'MALAYALAM', // Hardcoded since only Malayalam is used
                    english_word: english_word, 
                    translation: translation, 
                    extra_info: extra_info 
                }
            ]);
            
        if (error) throw error;
        
        alert("Saved successfully to database!");
        
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

// Event Listeners
document.getElementById('searchInput').addEventListener('input', handleSearchInput);

document.getElementById('backButton').addEventListener('click', () => { 
    document.getElementById('descriptionArea').style.display = 'none'; 
    document.getElementById('bookTableContainer').style.display = 'block'; 
});

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
});

document.getElementById('adminLoginBtn').addEventListener('click', () => { 
    const panel = document.getElementById('adminPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.style.animation = 'fadeIn 0.3s ease forwards';
    } else {
        panel.style.display = 'none';
    }
});

document.getElementById('contactButton').addEventListener('click', () => {
    const contact = document.getElementById('contactArea');
    if (contact.style.display === 'none') {
        contact.style.display = 'block';
        contact.style.animation = 'fadeIn 0.3s ease forwards';
    } else {
        contact.style.display = 'none';
    }
});

// Initialize
init();
