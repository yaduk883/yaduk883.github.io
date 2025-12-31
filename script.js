// ------------------------------------------
// 1. Configuration
// ------------------------------------------
const CONFIG = {
    MALAYALAM: {
        db: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1yXM-26NcSPpkrOMGFgvCRwYcFfzcaSSYGiD8mztHs_tJjUXLoFf7F-J2kwEWEw/pub?output=csv",
        api: "https://script.google.com/macros/s/AKfycby6ZYrMlmhDhjm5G2GFd-vrNuR1GHiZYcU3KTgvE1l8dVTIa3rQrn0LGUrzTRHwfxQv4Q/exec"
    },
    BODO: {
        db: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLtdSVACMT2lwL9zKyOMuhrFiIpzKrZSjR0leijaTbBV5akRBlQCNwa8zVRxqvqA/pub?output=csv",
        api: "https://script.google.com/macros/s/AKfycbxPo_6gATFfSkQv6Juy8eme2AH9Q5SwKYWkeEzS20_7CnHAQen3_I6DsSvw0STRXju9vg/exec"
    }
};

let currentLanguage = "MALAYALAM";
let dictionaryData = [];
let groupedDictionaryData = {};
let lastFilterResults = [];

// ------------------------------------------
// 2. Core Logic
// ------------------------------------------

async function init() {
    const status = document.getElementById('statusMessage');
    status.textContent = `Loading ${currentLanguage} Dictionary...`;
    
    try {
        const response = await fetch(CONFIG[currentLanguage].db);
        const csvText = await response.text();
        dictionaryData = parseCSV(csvText);
        
        groupedDictionaryData = {};
        dictionaryData.forEach(item => {
            if (!groupedDictionaryData[item.english]) groupedDictionaryData[item.english] = [];
            groupedDictionaryData[item.english].push(item);
        });

        status.textContent = "Ready! Search English or Translation words.";
    } catch (e) {
        status.textContent = "⚠️ Error loading data. Ensure Sheet is Published to Web as CSV.";
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    // Mapping your Bodo Headings
    const engIdx = headers.findIndex(h => h.includes('english word') || h.includes('from'));
    const meaningIdx = headers.findIndex(h => h.includes('meaning') || h.includes('to'));
    const expIdx = headers.findIndex(h => h.includes('explanation'));
    const transIdx = headers.findIndex(h => h.includes('transliteration'));

    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(csvRegex);
        if (row[engIdx]) {
            data.push({
                english: row[engIdx].replace(/^"|"$/g, '').trim(),
                translation: row[meaningIdx] ? row[meaningIdx].replace(/^"|"$/g, '').trim() : '',
                explanation: expIdx !== -1 && row[expIdx] ? row[expIdx].replace(/^"|"$/g, '').trim() : '',
                transliteration: transIdx !== -1 && row[transIdx] ? row[transIdx].replace(/^"|"$/g, '').trim() : ''
            });
        }
    }
    return data;
}

// ------------------------------------------
// 3. UI & Search
// ------------------------------------------

function filterData(query) {
    const q = query.toLowerCase().trim();
    const status = document.getElementById('statusMessage');
    document.getElementById('descriptionArea').style.display = 'none';
    
    if (!q) {
        document.getElementById('bookTableContainer').style.display = 'none';
        status.textContent = "Start typing above to search.";
        return;
    }

    const allKeys = Object.keys(groupedDictionaryData);
    
    // 1. Find the Exact Match first
    const exactMatch = allKeys.filter(key => key.toLowerCase() === q);
    
    // 2. Find Closely Related (words that START with the search term)
    // We exclude the exact match from this list to avoid duplicates
    const relatedMatches = allKeys.filter(key => 
        key.toLowerCase().startsWith(q) && key.toLowerCase() !== q
    );

    // 3. Combine them: Exact match always goes to index [0]
    const finalResults = [...exactMatch, ...relatedMatches];

    if (finalResults.length > 0) {
        status.textContent = ""; 
        renderTable(finalResults);
    } else {
        document.getElementById('bookTableContainer').style.display = 'none';
        status.textContent = "❌ No matching words found.";
    }
}

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
        row.insertCell().textContent = groupedDictionaryData[key].map(e => e.translation).join(' / ');
    });
}

function showDetails(word) {
    document.getElementById('bookTableContainer').style.display = 'none';
    const entries = groupedDictionaryData[word];
    const title = document.getElementById('descriptionTitle');
    const def = document.getElementById('definitionText');
    
    title.innerHTML = `<span class="english-title-word">${word}</span> <button class="copy-button" onclick="copyWord('${word}')">Copy</button>`;
    
    let html = '';
    entries.forEach(e => {
        html += `
            <div style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <p><strong>Translation:</strong> ${e.translation} <button class="copy-button" onclick="copyWord('${e.translation}')">📋</button></p>
                ${e.transliteration ? `<p><em>Pronunciation:</em> ${e.transliteration}</p>` : ''}
                ${e.explanation ? `<p><strong>Explanation:</strong> ${e.explanation}</p>` : ''}
            </div>
        `;
    });
    
    def.innerHTML = html;
    document.getElementById('descriptionArea').style.display = 'block';
}

// ------------------------------------------
// 4. Admin & Auth
// ------------------------------------------

async function handleLogin() {
    const user = prompt("Admin Username:");
    const pass = prompt("Admin Password:");
    if (!user || !pass) return;

    try {
        const response = await fetch(CONFIG[currentLanguage].api, {
            method: "POST",
            body: JSON.stringify({ action: "login", user, pass })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('adminPanel').style.display = 'block';
            document.getElementById('adminPanelTitle').textContent = `🛠 Admin: ${currentLanguage}`;
            alert("✅ Welcome Admin!");
        } else { alert("❌ Incorrect Credentials."); }
    } catch (e) { alert("Server connection failed. Ensure Web App is deployed correctly."); }
}

async function saveNewWord() {
    const from = document.getElementById('newEnglish').value.trim();
    const to = document.getElementById('newTranslation').value.trim();
    const type = document.getElementById('newType').value.trim();

    if (!from || !to) return alert("Fill English and Translation.");

    try {
        const response = await fetch(CONFIG[currentLanguage].api, {
            method: "POST",
            body: JSON.stringify({ action: "add", from, to, type })
        });
        const result = await response.json();
        if (result.success) {
            alert("🚀 Saved to Google Sheet!");
            document.getElementById('newEnglish').value = '';
            document.getElementById('newTranslation').value = '';
        }
    } catch (e) { alert("Failed to save."); }
}

// ------------------------------------------
// 5. Events
// ------------------------------------------

function copyWord(t) { navigator.clipboard.writeText(t).then(() => alert("Copied!")); }
function contactMe() { const a = document.getElementById('contactArea'); a.style.display = a.style.display==='none'?'block':'none'; }
function logout() { document.getElementById('adminPanel').style.display='none'; }

document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');
document.getElementById('adminLoginBtn').onclick = handleLogin;
document.getElementById('contactButton').onclick = contactMe;
document.getElementById('backButton').onclick = () => { document.getElementById('descriptionArea').style.display='none'; renderTable(lastFilterResults); };
document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);

init();
