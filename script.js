const CONFIG = {
    MALAYALAM: {
        db: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1yXM-26NcSPpkrOMGFgvCRwYcFfzcaSSYGiD8mztHs_tJjUXLoFf7F-J2kwEWEw/pub?output=csv",
        api: "https://script.google.com/macros/s/AKfycby6ZYrMlmhDhjm5G2GFd-vrNuR1GHiZYcU3KTgvE1l8dVTIa3rQrn0LGUrzTRHwfxQv4Q/exec"
    },
    BODO: {
        db: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLtdSVACMT2lwL9zKyOMuhrFiIpzKrZSjR0leijaTbBV5akRBlQCNwa8zVRxqvqA/pub?output=csv",
        api: "https://script.google.com/macros/s/AKfycbxPo_6gATFfSkQv6Juy8eme2AH9Q5SwKYWkeEzS20_7CnHAQen3_I6DsSvw0STRXju9vg/exec"
    },
    MAITHILI: {
        db: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqfZN9eJsap8DysSBopEJNkWqgtSpYR6i_fQHyjUBaEefbYmDHPxBY-AR0nlbv8w/pub?output=csv",
        api: "https://script.google.com/macros/s/AKfycbwoppmiL23b37fFf8kntY-JHPUXW6D8IM26wFET0Dni8Z3wIvI_X67ZM0O_HDXP7OVA/exec"
    }
};

let currentLanguage = "MALAYALAM";
let dictionaryData = [];
let groupedDictionaryData = {};
let lastFilterResults = [];

// --- INITIALIZATION ---
async function init() {
    const status = document.getElementById('statusMessage');
    if (status) status.textContent = `🔄 Syncing ${currentLanguage}...`;
    try {
        const response = await fetch(CONFIG[currentLanguage].db + '&t=' + new Date().getTime());
        const csvText = await response.text();
        dictionaryData = parseCSV(csvText);
        
        groupedDictionaryData = {};
        dictionaryData.forEach(item => {
            if (!groupedDictionaryData[item.english]) groupedDictionaryData[item.english] = [];
            groupedDictionaryData[item.english].push(item);
        });
        if (status) status.textContent = "✅ Ready!";
    } catch (e) { 
        if (status) status.textContent = "⚠️ Load Error."; 
        console.error("Fetch error:", e);
    }
}

// --- DATA PARSER (BODO LOGIC FIXED) ---
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        let row = lines[i].split(csvRegex);
        if (row.length < 2) continue;

        let english = row[0].replace(/"/g, '').trim();
        let translation = "";
        let extra = ""; 
        let explanation = "";

        if (currentLanguage === "BODO") {
            // Index 1: Explanation, Index 2: Bodo Meaning, Index 3: Transliteration
            explanation = (row[1] || "").replace(/"/g, '').trim();
            translation = (row[2] || "").replace(/"/g, '').trim();
            extra = (row[3] || "").replace(/"/g, '').trim();
        } 
        else if (currentLanguage === "MALAYALAM") {
            extra = (row[1] || "").replace(/"/g, '').trim(); 
            translation = (row[2] || "").replace(/"/g, '').trim();
        } 
        else if (currentLanguage === "MAITHILI") {
            translation = (row[1] || "").replace(/"/g, '').trim();
            extra = (row[2] || "").replace(/"/g, '').trim();
        }

        if (english) {
            data.push({ english, translation, extra, explanation });
        }
    }
    return data;
}

// --- IMPROVED SEARCH LOGIC ---
function filterData(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('bookTableContainer');
    if (!q) { 
        if (container) container.style.display = 'none'; 
        return; 
    }

    // 1. Filter all individual entries (not grouped)
    let results = dictionaryData.filter(item => 
        item.english.toLowerCase().includes(q) || 
        item.translation.toLowerCase().includes(q)
    );

    // 2. Sort results by relevance (Exact Match > Starts With > Includes)
    results.sort((a, b) => {
        const aEng = a.english.toLowerCase();
        const bEng = b.english.toLowerCase();
        
        // Exact Match
        if (aEng === q && bEng !== q) return -1;
        if (bEng === q && aEng !== q) return 1;

        // Starts With
        if (aEng.startsWith(q) && !bEng.startsWith(q)) return -1;
        if (bEng.startsWith(q) && !aEng.startsWith(q)) return 1;

        // Alphabetical fallback
        return aEng.localeCompare(bEng);
    });

    renderTable(results);
}

// --- UPDATED TABLE RENDERING ---
function renderTable(dataList) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    if (!tbody) return;

    tbody.innerHTML = ''; 
    if (dataList.length === 0) { 
        container.style.display = 'none'; 
        return; 
    }

    container.style.display = 'block';
    
    // Now rendering every individual entry found
    dataList.forEach(item => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(item.english);
        
        const cellEng = row.insertCell();
        cellEng.textContent = item.english;
        cellEng.style.fontWeight = "bold";

        const cellTr = row.insertCell();
        cellTr.textContent = item.translation;
    });
}

// --- DETAIL VIEW ---
function showDetails(word) {
    document.getElementById('bookTableContainer').style.display = 'none';
    const entries = groupedDictionaryData[word];
    let html = '';
    entries.forEach(e => {
        let tagLabel = (currentLanguage === "MALAYALAM") ? "Grammar" : "Transliteration";
        html += `
            <div class="detail-item">
                <p style="font-size: 1.25rem; margin:0; font-weight: 600; color: var(--primary-color);">
                    ${e.translation} 
                    <button onclick="navigator.clipboard.writeText('${e.translation}')" class="copy-btn-mini">📋</button>
                </p>
                ${e.extra ? `<p style="font-size: 0.85rem; color: #777; margin: 4px 0;"><em>${tagLabel}: ${e.extra}</em></p>` : ''}
                ${e.explanation ? `<p class="explanation-box"><strong>Explanation:</strong> ${e.explanation}</p>` : ''}
            </div>
        `;
    });
    document.getElementById('definitionText').innerHTML = html;
    document.getElementById('descriptionTitle').textContent = word;
    document.getElementById('descriptionArea').style.display = 'block';
}

// --- ADMIN & LOGIN LOGIC ---
async function performLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    try {
        const resp = await fetch(CONFIG[currentLanguage].api, { 
            method: "POST", 
            body: JSON.stringify({ action: "login", user, pass }) 
        });
        const res = await resp.json();
        if(res.success) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('entryForm').style.display = 'block';
        } else { alert("Login Failed"); }
    } catch(e) { alert("Server Error"); }
}

async function saveNewWord() {
    const from = document.getElementById('newEnglish').value;
    const meaning = document.getElementById('newTranslation').value;
    const extra = document.getElementById('newExtra').value; // Translit or Grammar
    const expl = document.getElementById('newExpl').value; // Bodo Explanation
    
    try {
        const resp = await fetch(CONFIG[currentLanguage].api, { 
            method: "POST", 
            body: JSON.stringify({ action: "add", from, meaning, extra, expl }) 
        });
        alert("Saved successfully!");
        init(); // Refresh data
    } catch(e) { alert("Save failed"); }
}

function logout() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
}

// --- EVENT LISTENERS ---
document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);
document.getElementById('backButton').onclick = () => { document.getElementById('descriptionArea').style.display='none'; renderTable(lastFilterResults); };
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
