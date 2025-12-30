// ------------------------------------------
// 1. Configuration
// ------------------------------------------
const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycby6ZYrMlmhDhjm5G2GFd-vrNuR1GHiZYcU3KTgvE1l8dVTIa3rQrn0LGUrzTRHwfxQv4Q/exec";

const DICTIONARIES = {
    MALAYALAM: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1yXM-26NcSPpkrOMGFgvCRwYcFfzcaSSYGiD8mztHs_tJjUXLoFf7F-J2kwEWEw/pub?output=csv",
    BODO: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLtdSVACMT2lwL9zKyOMuhrFiIpzKrZSjR0leijaTbBV5akRBlQCNwa8zVRxqvqA/pub?output=csv" 
};

let currentLanguage = "MALAYALAM";
let dictionaryData = []; 
let lastFilterResults = []; 
let groupedDictionaryData = {}; 

// ------------------------------------------
// 2. Admin & Auth Functions
// ------------------------------------------

async function handleLogin() {
    const user = prompt("Admin Username:");
    const pass = prompt("Admin Password:");
    if (!user || !pass) return;

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "login", user, pass })
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('adminPanel').style.display = 'block';
            alert("✅ Welcome Admin!");
        } else {
            alert("❌ Login Failed: Incorrect credentials. Check your Google Apps Script Code.gs variables.");
        }
    } catch (e) { 
        console.error("Login Error:", e);
        alert("⚠️ Connection failed. \n1. Ensure your Web App is deployed for 'Anyone'.\n2. Ensure you authorised the script in the Apps Script editor."); 
    }
}

async function saveNewWord() {
    const from = document.getElementById('newEnglish').value.trim();
    const to = document.getElementById('newTranslation').value.trim();
    const type = document.getElementById('newType').value.trim();

    if (!from || !to) return alert("Please enter both English and Translation.");

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "add", from, to, type })
        });
        const result = await response.json();
        if (result.success) {
            alert("🚀 Saved to Google Sheet!");
            document.getElementById('newEnglish').value = '';
            document.getElementById('newTranslation').value = '';
            document.getElementById('newType').value = '';
        }
    } catch (e) { alert("Failed to save word."); }
}

function logout() {
    document.getElementById('adminPanel').style.display = 'none';
}

// ------------------------------------------
// 3. UI Logic
// ------------------------------------------

function contactMe() {
    const area = document.getElementById('contactArea');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function copyWord(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied: " + text);
    });
}

function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

// ------------------------------------------
// 4. Dictionary Core Logic
// ------------------------------------------

async function fetchCSVData() {
    const url = DICTIONARIES[currentLanguage];
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error();
        return await response.text();
    } catch (e) { return null; }
}

function normalizeHeader(header) {
    return header.replace(/"/g, '').trim().toLowerCase();
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(normalizeHeader);
    
    // Automatically find columns by your headings
    const fromIdx = headers.findIndex(h => h.includes('english') || h.includes('from'));
    const toIdx = headers.findIndex(h => h.includes('meaning') || h.includes('to'));
    const expIdx = headers.findIndex(h => h.includes('explanation'));
    const transIdx = headers.findIndex(h => h.includes('transliteration'));
    
    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(csvRegex);
        if (values[fromIdx]) {
            data.push({
                fromContent: values[fromIdx].replace(/^"|"$/g, '').trim(),
                toContent: values[toIdx] ? values[toIdx].replace(/^"|"$/g, '').trim() : '',
                explanation: expIdx !== -1 && values[expIdx] ? values[expIdx].replace(/^"|"$/g, '').trim() : '',
                transliteration: transIdx !== -1 && values[transIdx] ? values[transIdx].replace(/^"|"$/g, '').trim() : ''
            });
        }
    }
    return data;
}

function groupData(data) {
    const grouped = {};
    data.forEach(item => {
        const key = item.fromContent;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });
    return grouped;
}

function filterData(query) {
    const q = query.toLowerCase().trim();
    document.getElementById('descriptionArea').style.display = 'none';
    
    if (!q) {
        document.getElementById('bookTableContainer').style.display = 'none';
        document.getElementById('statusMessage').textContent = "Start typing above to search.";
        return;
    }

    const keys = Object.keys(groupedDictionaryData).filter(key => 
        key.toLowerCase() === q || groupedDictionaryData[key].some(e => e.toContent.toLowerCase() === q)
    );
    renderTable(keys);
}

function renderTable(keys) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    const status = document.getElementById('statusMessage');
    tbody.innerHTML = '';
    lastFilterResults = keys;

    if (keys.length === 0) {
        container.style.display = 'none';
        status.textContent = "❌ No exact match found.";
        return;
    }

    container.style.display = 'block';
    keys.forEach(key => {
        const row = tbody.insertRow();
        row.onclick = () => showDetails(key);
        row.insertCell().textContent = key;
        row.insertCell().textContent = groupedDictionaryData[key].map(e => e.toContent).join(' / ');
    });
    status.textContent = `🔎 Found ${keys.length} result(s).`;
}

function showDetails(word) {
    document.getElementById('bookTableContainer').style.display = 'none';
    const group = groupedDictionaryData[word];
    const title = document.getElementById('descriptionTitle');
    const def = document.getElementById('definitionText');
    
    title.innerHTML = `📜 <span class="english-title-word">${word}</span> <button class="copy-button" onclick="copyWord('${word}')">Copy Word</button>`;
    
    // Display Bodo Specific fields (Explanation/Transliteration)
    const detailHTML = group.map(e => `
        <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
            <p><strong>Translation:</strong> ${e.toContent} <button class="copy-button" onclick="copyWord('${e.toContent}')">📋</button></p>
            ${e.transliteration ? `<p><em>Pronunciation:</em> ${e.transliteration}</p>` : ''}
            ${e.explanation ? `<p><strong>Explanation:</strong> ${e.explanation}</p>` : ''}
        </div>
    `).join('');
    
    def.innerHTML = detailHTML;
    document.getElementById('descriptionArea').style.display = 'block';
}

async function init() {
    const status = document.getElementById('statusMessage');
    status.textContent = `Loading ${currentLanguage} Dictionary...`;
    
    const csv = await fetchCSVData();
    if (csv) {
        dictionaryData = parseCSV(csv);
        groupedDictionaryData = groupData(dictionaryData);
        status.textContent = "Ready! Search English or Translation words.";
    } else {
        status.textContent = "⚠️ Error loading data. Ensure the Google Sheet is Published to Web.";
    }
}

// ------------------------------------------
// 5. Event Listeners
// ------------------------------------------

document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('dark-theme');
document.getElementById('adminLoginBtn').onclick = handleLogin;
document.getElementById('contactButton').onclick = contactMe;
document.getElementById('languageSelect').onchange = (e) => {
    currentLanguage = e.target.value;
    init();
};
document.getElementById('backButton').onclick = () => {
    document.getElementById('descriptionArea').style.display = 'none';
    renderTable(lastFilterResults);
};
document.getElementById('searchInput').oninput = debounce((e) => filterData(e.target.value), 300);

init();
