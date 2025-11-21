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

let bookData = []; // Global array to hold the parsed data

// ------------------------------------------
// Core Functions
// ------------------------------------------

/**
 * Fetches the CSV data from the Google Sheet URL.
 * (No change to this function, it remains the same)
 */
async function fetchCSVData() {
    // We update the message *after* the user starts searching, not here.
    try {
        const response = await fetch(GOOGLE_SHEET_CSV);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        document.getElementById(STATUS_MESSAGE_ID).textContent = `⚠️ Failed to load book data: ${error.message}`;
        document.getElementById(STATUS_MESSAGE_ID).className = 'error';
        console.error("Fetch Error:", error);
        return null;
    }
}

/**
 * Parses the CSV text into an array of book objects.
 * (No change to this function, it remains the same)
 */
function parseCSV(csvText) {
    // Simple parser: split by newline, then split by comma/separator
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Clean headers: remove quotes and trim whitespace
    const headers = lines[0].split(',').map(header => 
        header.replace(/"/g, '').trim()
    );

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma, ignoring commas inside quotes
        if (values.length === headers.length) {
            let book = {};
            values.forEach((value, index) => {
                const cleanValue = value.replace(/"/g, '').trim();
                book[headers[index]] = cleanValue;
            });
            // Only include books with a name
            if (book['Name of Book']) {
                 data.push(book);
            }
        }
    }
    return data;
}


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

    // List of columns to display, matching the <thead> in index.html
    const displayKeys = [
        'Name of Book', 'Author', 'Language', 'N.o of Copies', 
        'Available/Not', 'Checked Out By'
    ];

    dataToDisplay.forEach(book => {
        const row = tbody.insertRow();
        
        // --- ADD CLICK HANDLER ---
        row.style.cursor = 'pointer'; 
        row.addEventListener('click', () => {
            // Remove selection highlight from all rows
            Array.from(tbody.children).forEach(r => r.style.backgroundColor = '');
            // Highlight the clicked row
            row.style.backgroundColor = '#eef7ff'; 
            displayDescription(book);
        });
        // --- END CLICK HANDLER ---


        displayKeys.forEach(key => {
            const cell = row.insertCell();
            let value = book[key] || ''; // Use empty string if key is missing

            if (key === 'Available/Not') {
                cell.textContent = value;
                // Add styling class
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

/**
 * Filters the global bookData based on the search query.
 * @param {string} query - The text to search for.
 */
function filterData(query) {
    const queryLower = query.toLowerCase().trim();
    const status = document.getElementById(STATUS_MESSAGE_ID);

    if (!queryLower) {
        // Clear table and show introductory message when search box is empty
        document.getElementById(TABLE_BODY_ID).innerHTML = '';
        document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none';
        status.textContent = "Start typing above to search by Book Name or Author.";
        status.className = 'info';
        return;
    }

    const filtered = bookData.filter(book => {
        const nameMatch = book['Name of Book'] && book['Name of Book'].toLowerCase().includes(queryLower);
        const authorMatch = book['Author'] && book['Author'].toLowerCase().includes(queryLower);
        return nameMatch || authorMatch;
    });

    renderTable(filtered);
}

// ------------------------------------------
// Initialization (Main Execution)
// ------------------------------------------
async function init() {
    const searchInput = document.getElementById(SEARCH_INPUT_ID);
    
    // Initial fetch of data (hidden from user)
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

    // Add event listener for real-time filtering
    searchInput.addEventListener('input', (e) => {
        filterData(e.target.value);
    });
}

// Run the initialization function when the page is fully loaded
document.addEventListener('DOMContentLoaded', init);
