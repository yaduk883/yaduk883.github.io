// ------------------------------------------
// Configuration
// ------------------------------------------
const GOOGLE_SHEET_CSV = "https://docs.google.com/spreadsheets/d/10foSwd8HyCbltVFYT5HpuiiQMk9FFIkn-aVhH93_A78/gviz/tq?tqx=out:csv";
const TABLE_BODY_ID = 'bookTableBody';
const SEARCH_INPUT_ID = 'searchInput';
const STATUS_MESSAGE_ID = 'statusMessage';
const DESCRIPTION_AREA_ID = 'descriptionArea';
const DESCRIPTION_TITLE_ID = 'descriptionTitle';
const DESCRIPTION_TEXT_ID = 'descriptionText';
const THEME_TOGGLE_ID = 'themeToggle'; // New ID
const THEME_STORAGE_KEY = 'bookLibraryTheme'; // New Key

let bookData = []; // Global array to hold the parsed data

// ------------------------------------------
// Theme Functions (NEW)
// ------------------------------------------

/**
 * Toggles the 'dark-theme' class on the body and updates the button text/icon.
 */
function toggleTheme() {
    const body = document.body;
    const button = document.getElementById(THEME_TOGGLE_ID);
    
    // Toggle the class
    const isDark = body.classList.toggle('dark-theme');

    // Update the button text
    if (isDark) {
        button.innerHTML = '🌙 Switch to Light';
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
        button.innerHTML = '☀️ Switch to Dark';
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
}

/**
 * Loads the user's saved theme preference on page load.
 */
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const button = document.getElementById(THEME_TOGGLE_ID);
    const body = document.body;

    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        button.innerHTML = '🌙 Switch to Light';
    } else {
        // Default to light theme if no preference or preference is 'light'
        body.classList.remove('dark-theme');
        button.innerHTML = '☀️ Switch to Dark';
    }
}


// ------------------------------------------
// Core Functions (Modified DisplayDescription and RenderTable for Class)
// ------------------------------------------

// ... fetchCSVData and parseCSV remain unchanged ...

/**
 * Displays the description for a selected book.
 * @param {Object} book - The book object to display.
 */
function displayDescription(book) {
    const titleElement = document.getElementById(DESCRIPTION_TITLE_ID);
    const textElement = document.getElementById(DESCRIPTION_TEXT_ID);
    const area = document.getElementById(DESCRIPTION_AREA_ID);

    titleElement.textContent = `📝 ${book['Name of Book']}`;
    
    let description = book['Description'] || "No description available.";
    textElement.textContent = description;

    area.style.display = 'block'; // Show the description box
}


/**
 * Renders the table rows based on the filtered data and adds click handlers.
 * (Modified to use a class 'selected-row' instead of inline style for consistency)
 * @param {Array<Object>} dataToDisplay - The filtered book data.
 */
function renderTable(dataToDisplay) {
    const tbody = document.getElementById(TABLE_BODY_ID);
    const status = document.getElementById(STATUS_MESSAGE_ID);
    
    tbody.innerHTML = ''; // Clear existing rows
    document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none'; // Hide description

    if (dataToDisplay.length === 0) {
        status.textContent = "❌ No matches found. Try a different search term.";
        status.className = 'error';
        return;
    }

    const displayKeys = [
        'Name of Book', 'Author', 'Language', 'N.o of Copies', 
        'Available/Not', 'Checked Out By'
    ];

    dataToDisplay.forEach(book => {
        const row = tbody.insertRow();
        
        row.style.cursor = 'pointer'; 
        row.addEventListener('click', () => {
            // Remove 'selected-row' class from all rows
            Array.from(tbody.children).forEach(r => r.classList.remove('selected-row'));
            // Add 'selected-row' class to the clicked row
            row.classList.add('selected-row'); 
            displayDescription(book);
        });

        displayKeys.forEach(key => {
            const cell = row.insertCell();
            let value = book[key] || '';

            if (key === 'Available/Not') {
                cell.textContent = value;
                if (value.toLowerCase() === 'available') {
                    cell.classList.add('available');
                } else if (value.toLowerCase() === 'not available') {
                    cell.classList.add('not-available');
                }
            } else {
                cell.textContent = value;
            }
        });
    });

    status.textContent = `🔎 ${dataToDisplay.length} match(es) found. Click a row to view the description.`;
    status.className = 'info';
}

// ... filterData remains unchanged ...

// ------------------------------------------
// Initialization (Main Execution)
// ------------------------------------------
async function init() {
    // 1. Load Theme First
    loadTheme();
    
    // 2. Add Listener for Theme Toggle
    document.getElementById(THEME_TOGGLE_ID).addEventListener('click', toggleTheme);
    
    // 3. Continue with Data Fetch
    const searchInput = document.getElementById(SEARCH_INPUT_ID);
    const status = document.getElementById(STATUS_MESSAGE_ID);
    
    status.textContent = 'Loading data in the background...';

    const csvText = await fetchCSVData();
    if (!csvText) return;

    bookData = parseCSV(csvText);
    
    if (bookData.length > 0) {
        status.textContent = "Start typing above to search by Book Name or Author.";
        status.className = 'info';
    } else {
        status.textContent = `⚠️ Data loaded but no books found.`;
        status.className = 'error';
        return;
    }

    // 4. Add Search Listener
    searchInput.addEventListener('input', (e) => {
        filterData(e.target.value);
    });
}

// Run the initialization function when the page is fully loaded
document.addEventListener('DOMContentLoaded', init);
