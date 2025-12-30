// 1. Configuration
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycby6ZYrMlmhDhjm5G2GFd-vrNuR1GHiZYcU3KTgvE1l8dVTIa3rQrn0LGUrzTRHwfxQv4Q/exec";

const DICTIONARIES = {
    MALAYALAM: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1yXM-26NcSPpkrOMGFgvCRwYcFfzcaSSYGiD8mztHs_tJjUXLoFf7F-J2kwEWEw/pub?output=csv",
    BODO: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLtdSVACMT2lwL9zKyOMuhrFiIpzKrZSjR0leijaTbBV5akRBlQCNwa8zVRxqvqA/pub?output=csv"
};

let currentLanguage = "MALAYALAM";
let groupedDictionaryData = {};
let lastFilterResults = [];

// 2. CSV Parser (Fixed for your Bodo Headings)
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    // FIND COLUMNS BY YOUR HEADINGS:
    const fromIdx = headers.findIndex(h => h.includes('english word') || h.includes('from'));
    const toIdx = headers.findIndex(h => h.includes('bodo meaning') || h.includes('malayalam') || h.includes('to'));
    const expIdx = headers.findIndex(h => h.includes('explanation'));
    const transIdx = headers.findIndex(h => h.includes('transliteration'));

    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(csvRegex);
        if (row[fromIdx]) {
            data.push({
                english: row[fromIdx].replace(/^"|"$/g, '').trim(),
                translation: row[toIdx] ? row[toIdx].replace(/^"|"$/g, '').trim() : '',
                explanation: expIdx !== -1 && row[expIdx] ? row[expIdx].replace(/^"|"$/g, '').trim() : '',
                transliteration: transIdx !== -1 && row[transIdx] ? row[transIdx].replace(/^"|"$/g, '').trim() : ''
            });
        }
    }
    return data;
}

// 3. Search & UI Logic
async function init() {
    const status = document.getElementById('statusMessage');
    status.textContent = `Loading ${currentLanguage} Dictionary...`;
    
    try {
        const response = await fetch(DICTIONARIES[currentLanguage]);
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        
        // Group data for English word lookup
        groupedDictionaryData = {};
        parsedData.forEach(item => {
            if (!groupedDictionaryData[item.english]) groupedDictionaryData[item.english] = [];
            groupedDictionaryData[item.english].push(item);
        });

        status.textContent = "Ready! Search English or Translation words.";
    } catch (e) {
        status.textContent = "⚠️ Error loading data. Ensure the Google Sheet is 'Published to Web' as CSV.";
    }
}

function filterData(query) {
    const q = query.toLowerCase().trim();
    document.getElementById('descriptionArea').style.display = 'none';
    const status = document.getElementById('statusMessage');

    if (!q) {
        document.getElementById('bookTableContainer').style.display = 'none';
        status.textContent = "Start typing to search.";
        return;
    }

    // Exact Match Search (Check English OR Translation)
    const matches = Object.keys(groupedDictionaryData).filter(key => 
        key.toLowerCase() === q || groupedDictionaryData[key].some(e => e.translation.toLowerCase() === q)
    );

    renderTable(matches);
}

function renderTable(keys) {
    const tbody = document.getElementById('bookTableBody');
    tbody.innerHTML = '';
    lastFilterResults = keys;

    if (keys.length === 0) {
        document.getElementById('bookTableContainer').style.display = 'none';
        document.getElementById('statusMessage').textContent = "❌ No exact match found.";
        return;
    }

    document.getElementById('bookTableContainer').style.display = 'block';
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
    const defArea = document.getElementById('definitionText');
    
    document.getElementById('descriptionTitle').innerHTML = `${word} <button class="copy-button" onclick="copyWord('${word}')">Copy</button>`;
    
    let html = '';
    entries.forEach(e => {
        html += `
            <div style="margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
                <p><strong>Translation:</strong> ${e.translation} <button class="copy-button" onclick="copyWord('${e.translation}')">📋</button></p>
                ${e.transliteration ? `<p><em>Pronunciation (Transliteration):</em> ${e.transliteration}</p>` : ''}
                ${e.explanation ? `<p><strong>Explanation:</strong> ${e.explanation}</p>` : ''}
            </div>
        `;
    });
    
    defArea.innerHTML = html;
    document.getElementById('descriptionArea').style.display = 'block';
}

// 4. Helpers & Events
function copyWord(txt) { navigator.clipboard.writeText(txt).then(() => alert("Copied!")); }
function contactMe() { const a = document.getElementById('contactArea'); a.style.display = a.style.display==='none'?'block':'none'; }
function logout() { document.getElementById('adminPanel').style.display='none'; }

document.getElementById('languageSelect').onchange = (e) => { currentLanguage = e.target.value; init(); };
document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');
document.getElementById('backButton').onclick = () => { document.getElementById('descriptionArea').style.display='none'; renderTable(lastFilterResults); };
document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);
document.getElementById('contactButton').onclick = contactMe;
document.getElementById('adminLoginBtn').onclick = () => {
    const u = prompt("User:"), p = prompt("Pass:");
    if(u === "admin" && p === "123") { // Replace with your logic or API call
        document.getElementById('adminPanel').style.display='block';
    } else { alert("Wrong credentials"); }
};

init();
