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

// Initialize & Load Data
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
        console.error(e);
    }
}



// The Heart of the App: The Multi-Format Parser
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        let row = lines[i].split(csvRegex);
        if (row.length < 2) continue;

        let english = row[0].replace(/"/g, '').trim();
        let translation = "";
        let extra = ""; // For Grammar or Transliteration
        let explanation = "";

        if (currentLanguage === "MALAYALAM") {
            // Pattern: English, Type, Meaning
            extra = (row[1] || "").replace(/"/g, '').trim(); 
            translation = (row[2] || "").replace(/"/g, '').trim();
        } 
        else if (currentLanguage === "BODO") {
            // Pattern: English, Explanation, Bodo Meaning, Transliteration
            explanation = (row[1] || "").replace(/"/g, '').trim();
            translation = (row[2] || "").replace(/"/g, '').trim();
            extra = (row[3] || "").replace(/"/g, '').trim();
        } 
        else if (currentLanguage === "MAITHILI") {
            // Pattern: English, Maithili Meaning, Transliteration
            translation = (row[1] || "").replace(/"/g, '').trim();
            extra = (row[2] || "").replace(/"/g, '').trim();
        }

        if (english) {
            data.push({ english, translation, extra, explanation });
        }
    }
    return data;
}

// Search & Filter Logic
function filterData(query) {
    const q = query.toLowerCase().trim();
    const container = document.getElementById('bookTableContainer');
    if (!q) { 
        if (container) container.style.display = 'none'; 
        return; 
    }
    
    const results = Object.keys(groupedDictionaryData).filter(key => 
        key.toLowerCase().includes(q) || 
        groupedDictionaryData[key].some(e => e.translation.toLowerCase().includes(q))
    );
    renderTable(results);
}

// Render Results Table
function renderTable(keys) {
    const container = document.getElementById('bookTableContainer');
    const tbody = document.getElementById('bookTableBody');
    if (!tbody || !container) return;

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
        row.insertCell().textContent = groupedDictionaryData[key][0].translation;
    });
}

// Show Detail View
function showDetails(word) {
    const tableContainer = document.getElementById('bookTableContainer');
    const descArea = document.getElementById('descriptionArea');
    const defText = document.getElementById('definitionText');
    const titleText = document.getElementById('descriptionTitle');

    if (tableContainer) tableContainer.style.display = 'none';
    const entries = groupedDictionaryData[word];
    let html = '';

    entries.forEach(e => {
        let label = (currentLanguage === "MALAYALAM") ? "Grammar" : "Transliteration";
        html += `<div class="detail-item">
            <p class="meaning-text">
                <strong>Meaning:</strong> ${e.translation} 
                <button onclick="navigator.clipboard.writeText('${e.translation}')" class="copy-btn-mini">📋</button>
            </p>`;
        
        if(e.extra) {
            html += `<p class="extra-text"><em>${label}: ${e.extra}</em></p>`;
        }
        
        if(e.explanation && currentLanguage === "BODO") {
            html += `<p class="explanation-text"><strong>Explanation:</strong> ${e.explanation}</p>`;
        }
        html += `</div>`;
    });

    if (defText) defText.innerHTML = html;
    if (titleText) titleText.textContent = word;
    if (descArea) descArea.style.display = 'block';
}

// Global UI Listeners
document.getElementById('languageSelect').onchange = (e) => { 
    currentLanguage = e.target.value; 
    init(); 
};

document.getElementById('searchInput').oninput = (e) => filterData(e.target.value);

document.getElementById('backButton').onclick = () => { 
    document.getElementById('descriptionArea').style.display='none'; 
    renderTable(lastFilterResults); 
};

// Start
init();
