/* --- 1. CSS Variables (The Core of Theming) --- */
:root {
    /* Light Theme Defaults */
    --primary-color: #1e88e5; /* Streamlit Blue */
    --background-color: #f4f7f6;
    --card-background: #ffffff;
    --text-color: #333;
    --border-color: #eee;
    --input-border-color: #ccc;
    --table-header-bg: #f0f0f0;
    --hover-bg: #eef7ff;
    --description-bg: #f9f9f9;
}

/* --- 2. Dark Theme Overrides --- */
body.dark-theme {
    --background-color: #1e1e1e;
    --card-background: #2d2d2d;
    --text-color: #f0f0f0;
    --border-color: #444;
    --input-border-color: #555;
    --table-header-bg: #3c3c3c;
    --hover-bg: #4a4a4a;
    --description-bg: #3a3a3a;
}

/* --- 3. Basic Reset and Typography --- */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
    /* Apply variables */
    background-color: var(--background-color);
    color: var(--text-color);
    transition: background-color 0.3s, color 0.3s;
}

.container {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
    /* Apply variables */
    background-color: var(--card-background);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

h1 {
    text-align: center;
    color: var(--primary-color);
    margin-bottom: 25px;
}

/* --- 4. Search Input and Controls --- */
.controls {
    margin-bottom: 20px;
    display: flex; /* Arrange button and input side-by-side */
    gap: 15px;
}

#searchInput {
    flex-grow: 1; /* Allow input to take remaining space */
    padding: 12px 15px;
    border: 1px solid var(--input-border-color);
    border-radius: 6px;
    font-size: 16px;
    box-sizing: border-box;
    background-color: var(--card-background);
    color: var(--text-color);
    transition: border-color 0.3s;
}

#searchInput:focus {
    border-color: var(--primary-color);
    outline: none;
}

/* Theme Button Styling */
.theme-button {
    padding: 12px 15px;
    border: none;
    border-radius: 6px;
    background-color: var(--primary-color);
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s, opacity 0.3s;
    white-space: nowrap; /* Prevents text wrap */
}
.theme-button:hover {
    opacity: 0.9;
}


/* --- 5. Status Message --- */
#statusMessage {
    padding: 10px;
    margin: 15px 0;
    border-radius: 4px;
    font-weight: bold;
    text-align: center;
}
.info { background-color: #e3f2fd; color: #1e88e5; }
.error { background-color: #ffebee; color: #d32f2f; }
/* Dark Theme Status Message adjustments */
body.dark-theme .info { background-color: #0b375b; color: #79b0e8; }
body.dark-theme .error { background-color: #5d1717; color: #ff8a80; }


/* --- 6. Table Styling --- */
#bookTableContainer {
    overflow-x: auto;
    margin-top: 20px;
}

#bookTable {
    width: 100%;
    border-collapse: collapse;
    background-color: var(--card-background);
}

#bookTable th, #bookTable td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
}

#bookTable th {
    background-color: var(--table-header-bg);
    font-weight: 600;
    color: var(--text-color);
    position: sticky;
    top: 0;
}

#bookTable tbody tr:hover {
    background-color: var(--hover-bg);
}

/* Highlighting Selected Row */
#bookTable tbody tr.selected-row {
    background-color: var(--hover-bg) !important;
}

/* Highlighting Available/Not */
.available {
    color: #388e3c; 
    font-weight: bold;
}

.not-available {
    color: #e64a19;
    font-weight: bold;
}

/* --- 7. Description Box Styling --- */
.description-box {
    margin-top: 30px;
    padding: 20px;
    border-left: 5px solid var(--primary-color);
    background-color: var(--description-bg);
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.description-box h3 {
    color: var(--text-color);
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.2em;
}
