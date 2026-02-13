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

// ------------------------------------------
// 2. Load & Sync Logic
// ------------------------------------------

async function init() {
    const status = document.getElementById('statusMessage');
    status.textContent = `Syncing ${currentLanguage} Dictionary...`;
    
    // Clear old data for a clean refresh
    dictionaryData = [];
    groupedDictionaryData = {};

    try {
        // Cache-busting ensures you get the LATEST data from the sheet immediately
        const cacheBuster = `&t=${new Date().getTime()}`;
        const response = await fetch(CONFIG[currentLanguage].db + cacheBuster);
        const csvText = await response.text();
        dictionaryData = parseCSV(csvText);
        
        // Group by English word for the detail view
        dictionaryData.forEach(item => {
            if (!groupedDictionaryData[item.english]) groupedDictionaryData[item.english] = [];
            groupedDictionaryData[item.english].push(item);
        });

        status.textContent = "✅ Dictionary Ready!";
        // Reset status message after 2 seconds
        setTimeout(() => { if(status.textContent.includes("Ready")) status.textContent = "Search English or Native words."; }, 2000);
    } catch (e) {
        console.error(e);
        status.textContent = "⚠️ Sync Error. Please check your internet connection.";
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    // Dynamic index mapping to handle different column names across sheets
    const engIdx = headers.findIndex(h => h.includes('word') || h.includes('english'));
    const meaningIdx = headers.findIndex(h => h.includes('maithili') || h.includes('meaning') || h.includes('translation') || h.includes('bodo') || h.includes('malayalam'));
    const transIdx = headers.findIndex(h => h.includes('transliteration'));
    const expIdx = headers.findIndex(h => h.includes('explanation') || h.includes('example'));

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
// 3. Search & UI (Silent Copy)
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
    
    // Bidirectional Check
    const exactMatch = allKeys.filter(key => 
        key.toLowerCase() === q || 
        groupedDictionaryData[key].some(e => e.translation.toLowerCase() === q)
    );
    
    const relatedMatches = allKeys.filter(key => {
        const matchesEnglish = key.toLowerCase().startsWith(q);
        const matchesTranslation = groupedDictionaryData[key].some(e => e.translation.toLowerCase().startsWith(q));
        return (matchesEnglish || matchesTranslation) && !exactMatch.includes(key);
    });

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
                ${e.explanation ? `<p><strong>Details:</strong> ${e.explanation}</p>` : ''}
            </div>
        `;
    });
    
    def.innerHTML = html;
    document.getElementById('descriptionArea').style.display = 'block';
}

// ------------------------------------------
// 4. Admin Panel & Helper Actions
// ------------------------------------------

function copyWord(t) { 
    // SILENT COPY: No alert pop-up shown
    navigator.clipboard.writeText(t); 
}

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
        } else { alert("❌ Incorrect Credentials."); }
    } catch (e) { alert("Server connection failed."); }
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
            alert("🚀 Saved! Refreshing dictionary...");
            document.getElementById('newEnglish').value = '';
            document.getElementById('newTranslation').value = '';
            document.getElementById('newType').value = '';
            init(); // Refresh data immediately
        }
    } catch (e) { alert("Failed to save."); }
}

function contactMe() { const a = document.getElementById('contactArea'); a.style.display = a.style.display==='none'?'block':'none'; }
function logout() { document.getElementById('adminPanel').style.display='none'; }

// ------------------------------------------
// 5. Event Listeners
// ------------------------------------------

document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');
document.getElementById('adminLoginBtn').onclick = handleLogin;
document.getElementById('contactButton').onclick = contactMe;
document.getElementById('backButton').onclick = () => { document.getElementById('descriptionArea').style.display='none'; renderTable(lastFilterResults); };
document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);

// First Load
init();
