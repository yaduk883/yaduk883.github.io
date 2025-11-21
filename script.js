// ------------------------------------------
// Configuration
// ------------------------------------------
const GOOGLE_SHEET_CSV = "https://docs.google.com/spreadsheets/d/10foSwd8HyCbltVFYT5HpuiiQMk9FFIkn-aVhH93_A78/gviz/tq?tqx=out:csv";
const TABLE_BODY_ID = 'bookTableBody';
const SEARCH_INPUT_ID = 'searchInput';
const STATUS_MESSAGE_ID = 'statusMessage';

let bookData = []; // Global array to hold the parsed data

// ------------------------------------------
// Core Functions
// ------------------------------------------

/**
 * Fetches the CSV data from the Google Sheet URL.
 * @returns {Promise<string>} The raw CSV text.
 */
async function fetchCSVData() {
    const status = document.getElementById(STATUS_MESSAGE_ID);
    status.textContent = 'Fetching data from Google Sheet...';
    try {
        const response = await fetch(GOOGLE_SHEET_CSV);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        status.textContent = `⚠️ Failed to load book data: ${error.message}`;
        status.className = 'error';
        console.error("Fetch Error:", error);
        return null;
    }
}

/**
 * Parses the CSV text into an array of book objects.
 * Expects the first row to be headers.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} The parsed data.
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
 * Renders the table rows based on the filtered data.
 * @param {Array<Object>} dataToDisplay - The filtered book data.
 */
function renderTable(dataToDisplay) {
    const tbody = document.getElementById(TABLE_BODY_ID);
    const status = document.getElementById(STATUS_MESSAGE_ID);
    
    tbody.innerHTML = ''; // Clear existing rows

    if (dataToDisplay.length === 0) {
        status.textContent = "❌ No matches found.";
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

    status.textContent = `🔎 ${dataToDisplay.length} book(s) displayed.`;
    status.className = 'info';
}

/**
 * Filters the global bookData based on the search query.
 * @param {string} query - The text to search for.
 */
function filterData(query) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
        // If query is empty, show all data
        renderTable(bookData);
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
    const csvText = await fetchCSVData();
    if (!csvText) return;

    bookData = parseCSV(csvText);
    
    // Initial render of all books
    renderTable(bookData); 

    // Add event listener for real-time filtering
    const searchInput = document.getElementById(SEARCH_INPUT_ID);
    searchInput.addEventListener('input', (e) => {
        filterData(e.target.value);
    });

    // Initial message update if data loaded successfully
    if (bookData.length > 0) {
        document.getElementById(STATUS_MESSAGE_ID).textContent = `✅ Successfully loaded ${bookData.length} books.`;
    } else {
        document.getElementById(STATUS_MESSAGE_ID).textContent = `⚠️ Data loaded but no books found.`;
        document.getElementById(STATUS_MESSAGE_ID).className = 'error';
    }
}

// Run the initialization function when the page is fully loaded
document.addEventListener('DOMContentLoaded', init);
