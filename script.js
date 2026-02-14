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

// Initialize and Fetch Data
async function init() {
    const status = document.getElementById('statusMessage');
    status.textContent = `🔄 Syncing ${currentLanguage}...`;
    try {
        const response = await fetch(CONFIG[currentLanguage].db + '&t=' + new Date().getTime());
        const csvText = await response.text();
        dictionaryData = parseCSV(csvText);
        
        groupedDictionaryData = {};
        dictionaryData.forEach(item => {
            if (!groupedDictionaryData[item.english]) groupedDictionaryData[item.english] = [];
            groupedDictionaryData[item.english].push(item);
        });
        status.textContent = "✅ Ready!";
    } catch (e) { 
        status.textContent = "⚠️ Load Error."; 
        console.error(e);
    }
}

// Corrected Parser for your 3-column Malayalam Sheet
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    // This regex correctly handles commas inside quotes in CSV cells
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        let row = lines[i].split(csvRegex);
        if (row.length < 2) continue;

        let english = row[0].replace(/"/g, '').trim();
        let tag = (row[1] || "").replace(/"/g, '').trim(); // {n}, {v}, etc.
        let meaning = (row[2] || "").replace(/"/g, '').trim(); // Malayalam Text

        if (english) {
            data.push({
                english: english,
                translation: (currentLanguage === "MALAYALAM") ? meaning : (meaning || tag),
                typeTag: (currentLanguage === "MALAYALAM") ? tag : ""
            });
        }
    }
    return data;
}

// Search Logic
function filterData(query) {
    const q = query.toLowerCase().trim();
    if (!q) { 
        document.getElementById('bookTableContainer').style.display = 'none'; 
        return; 
    }
    const allKeys = Object.keys(groupedDictionaryData);
    const results = allKeys.filter(key => 
        key.toLowerCase().includes(q) || 
        groupedDictionaryData[key].some(e => e.translation.toLowerCase().includes(q))
    );
    renderTable(results);
}

// Render Results Table
function renderTable(keys) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    tbody.innerHTML = ''; 
    lastFilterResults = keys;

    if (keys.length === 0) { 
        container.style.display = 'none'; 
        return; 
    }

    container.style.display = 'block';
    keys.forEach(key => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(key);
        row.insertCell().textContent = key;
        // Show meaning ONLY (Clean look)
        row.insertCell().textContent = groupedDictionaryData[key][0].translation;
    });
}

// Show Full Details
function showDetails(word) {
    document.getElementById('bookTableContainer').style.display = 'none';
    const entries = groupedDictionaryData[word];
    let html = '';
    entries.forEach(e => {
        html += `
            <div style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
                <p style="font-size: 1.1rem; margin:0;">
                    ${e.translation} 
                    <button onclick="navigator.clipboard.writeText('${e.translation}')" class="copy-btn-mini">📋</button>
                </p>
                ${e.typeTag ? `<p style="font-size: 0.85rem; color: #888; margin: 2px 0 0 0;"><em>Grammar: ${e.typeTag}</em></p>` : ''}
            </div>
        `;
    });
    document.getElementById('definitionText').innerHTML = html;
    document.getElementById('descriptionTitle').textContent = word;
    document.getElementById('descriptionArea').style.display = 'block';
}

// In-page Admin Login
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
        } else {
            alert("Login Denied");
        }
    } catch(e) { alert("Error connecting to login server."); }
}

// Save New Word to Sheet
async function saveNewWord() {
    const from = document.getElementById('newEnglish').value;
    const tag = document.getElementById('newType').value;
    const to = document.getElementById('newTranslation').value;
    try {
        await fetch(CONFIG[currentLanguage].api, { 
            method: "POST", 
            body: JSON.stringify({ action: "add", from, tag, to }) 
        });
        alert("Saved!"); 
        init(); 
    } catch(e) { alert("Failed to save."); }
}

// Global UI Handlers
function logout() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
}

document.getElementById('languageSelect').onchange = (e) => { 
    currentLanguage = e.target.value; 
    init(); 
};

document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');

document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);

document.getElementById('backButton').onclick = () => { 
    document.getElementById('descriptionArea').style.display='none'; 
    renderTable(lastFilterResults); 
};

document.getElementById('adminLoginBtn').onclick = () => { 
    const p = document.getElementById('adminPanel'); 
    p.style.display = p.style.display==='none' ? 'block' : 'none'; 
};

document.getElementById('contactButton').onclick = () => { 
    const c = document.getElementById('contactArea'); 
    c.style.display = c.style.display==='none' ? 'block' : 'none'; 
};

// Start App
init();
