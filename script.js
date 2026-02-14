// 1. Configuration
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

// 2. Data Fetching
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

// 3. Specialized Parser
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        let rowStr = lines[i].trim();
        if (!rowStr) continue;

        if (currentLanguage === "MALAYALAM") {
            // Regex to split: English {Tag} Meaning
            const match = rowStr.match(/^"?([^\{]+)\s*\{([^}]+)\}\s*([^"]+)"?$/);
            if (match) {
                data.push({ 
                    english: match[1].trim(), 
                    translation: match[3].trim(), 
                    tag: match[2].trim() 
                });
            } else {
                const parts = rowStr.split(',');
                data.push({ 
                    english: (parts[0] || '').replace(/"/g, '').trim(), 
                    translation: (parts[1] || '').replace(/"/g, '').trim(), 
                    tag: '' 
                });
            }
        } else {
            // Standard Comma Split for other languages
            const parts = rowStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            data.push({ 
                english: (parts[0] || '').replace(/"/g, '').trim(), 
                translation: (parts[1] || '').replace(/"/g, '').trim(), 
                tag: '' 
            });
        }
    }
    return data;
}

// 4. UI & Filtering
function copyWord(t) { navigator.clipboard.writeText(t); }

function filterData(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('bookTableContainer');
    if (!q) { container.style.display = 'none'; return; }
    
    const allKeys = Object.keys(groupedDictionaryData);
    const results = allKeys.filter(key => 
        key.toLowerCase().includes(q) || 
        groupedDictionaryData[key].some(e => e.translation.toLowerCase().includes(q))
    );
    renderTable(results);
}

function renderTable(keys) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    tbody.innerHTML = ''; 
    lastFilterResults = keys;

    if (keys.length === 0) { container.style.display = 'none'; return; }

    container.style.display = 'block';
    keys.forEach(key => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(key);
        row.insertCell().textContent = key;
        row.insertCell().textContent = groupedDictionaryData[key][0].translation;
    });
}

function showDetails(word) {
    document.getElementById('bookTableContainer').style.display = 'none';
    const entries = groupedDictionaryData[word];
    let html = '';
    entries.forEach(e => {
        html += `<p><strong>Meaning:</strong> ${e.translation} <button onclick="copyWord('${e.translation}')" style="cursor:pointer; background:none; border:1px solid #ccc; padding:2px 5px; border-radius:3px;">📋</button></p>`;
        if(e.tag) html += `<p><em>Grammar: {${e.tag}}</em></p>`;
    });
    document.getElementById('definitionText').innerHTML = html;
    document.getElementById('descriptionTitle').textContent = word;
    document.getElementById('descriptionArea').style.display = 'block';
}

// 5. Admin & Auth Logic
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
            alert("Login Failed: Incorrect Username or Password");
        }
    } catch(e) { alert("Server error during login."); }
}

async function saveNewWord() {
    const from = document.getElementById('newEnglish').value;
    const to = document.getElementById('newTranslation').value;
    const tag = document.getElementById('newType').value;
    
    const payload = currentLanguage === "MALAYALAM" ? `${from} {${tag}} ${to}` : from;
    
    try {
        await fetch(CONFIG[currentLanguage].api, { 
            method: "POST", 
            body: JSON.stringify({ action: "add", from: payload, to: to }) 
        });
        alert("Success: Saved to Google Sheet!"); 
        init(); 
    } catch(e) { alert("Error: Could not save word."); }
}

function logout() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('entryForm').style.display = 'none';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
}

// 6. Listeners
document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
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

// Start
init();
