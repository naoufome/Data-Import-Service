let workbook;
let selectedSheetName;
let currentSessionTemplate = {
    name: "New Template",
    mapping: {} // { excelColumnLetter: { dbField: string, isForeignKey: boolean, lookupTable?: string, lookupColumn?: string } }
};
let importTemplates = [];

const tableSelector = document.getElementById('tableSelector');
const tableSearch = document.getElementById('tableSearch');
let allTableNames = []; // To store all fetched table names for searching

// Get the container for available fields
const availableFieldsContainer = document.getElementById('availableFields');

// Helper functions
function colLetterToIndex(letter) {
    let column = 0;
    for (let i = 0; i < letter.length; i++) {
        column += (letter.charCodeAt(i) - 64) * Math.pow(26, letter.length - i - 1);
    }
    return column - 1; // 0-indexed
}

function getExcelColumnName(idx) {
    let result = '';
    while (idx >= 0) {
        result = String.fromCharCode(65 + (idx % 26)) + result;
        idx = Math.floor(idx / 26) - 1;
    }
    return result;
}

// New helper function to format date for MySQL
function formatDateForMySQL(date) {
    if (!(date instanceof Date)) {
        return date; // Return as is if not a Date object
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    // You can add time if needed: ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
    return `${year}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const importModal = document.getElementById('importModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const importFileSelector = document.getElementById('importFileSelector');
    const sheetButtonsContainer = document.getElementById('sheetButtonsContainer');
    const previewRangeBtn = document.getElementById('previewRangeBtn');
    const importerBtn = document.getElementById('importerBtn');
    const excelColumnsContainer = document.getElementById('excelColumnsContainer');
    const previewTableContainer = document.getElementById('previewTableContainer');
    const previewTable = document.getElementById('previewTable');
    const templateSelector = document.getElementById('templateSelector');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');

    // Modal interactions
    openModalBtn.addEventListener('click', () => {
        importModal.classList.remove('hidden');
        loadTemplates();
        loadTables(); // Load tables when modal opens
    });
    closeModalBtn.addEventListener('click', () => {
        importModal.classList.add('hidden');
    });

    // Event listener for table search input
    tableSearch.addEventListener('keyup', () => {
        const searchTerm = tableSearch.value.toLowerCase();
        const filteredTables = allTableNames.filter(tableName => 
            tableName.toLowerCase().includes(searchTerm)
        );
        renderTableOptions(filteredTables);
    });

    // Event listener for table selection
    tableSelector.addEventListener('change', async () => {
        const selectedTable = tableSelector.value;
        if (selectedTable) {
            console.log('Table selected:', selectedTable);
            await fetchAndRenderColumns(selectedTable);
        } else {
            // Clear fields if no table is selected
            availableFieldsContainer.innerHTML = '';
            console.log('No table selected, cleared available fields.');
        }
    });

    // Handle file selection
    importFileSelector.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, { type: 'array', cellDates: true });
                renderSheetButtons(workbook.SheetNames);
            };
            reader.readAsArrayBuffer(file);
        }
    });

    // Preview Range
    previewRangeBtn.addEventListener('click', () => {
        if (!workbook || !selectedSheetName) {
            alert('Please select a file and a sheet first.');
            return;
        }

        const startCol = document.getElementById('rangeStartCol').value.toUpperCase();
        const startRow = document.getElementById('rangeStartRow').value;
        const endCol = document.getElementById('rangeEndCol').value.toUpperCase();
        const endRow = document.getElementById('rangeEndRow').value;

        if (!startCol || !startRow || !endCol || !endRow) {
            alert('Please define the complete range (start/end column and row).');
            return;
        }

        const rangeStr = `${startCol}${startRow}:${endCol}${endRow}`;
        const sheet = workbook.Sheets[selectedSheetName];
        let rawData;
        try {
            rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: rangeStr, defval: "", cellDates: true });
        } catch (e) {
            console.error("Error reading range:", e);
            alert("Could not read the specified range. Please check the range and selected sheet.");
            return;
        }

        if (rawData.length === 0) {
            alert('No data found in the specified range.');
            // Clear UI if no data
            renderExcelColumns(0, {});
            previewTableContainer.classList.add('hidden');
            return;
        }

        const headers = rawData[0];
        const dataRows = rawData.slice(1);

        renderExcelColumns(headers.length, currentSessionTemplate.mapping);
        renderPreviewTable(headers, dataRows);
    });

    // Drag and Drop Logic
    let draggedFieldKey = null;

    document.querySelectorAll('.draggable-field').forEach(field => {
        field.addEventListener('dragstart', (e) => {
            draggedFieldKey = e.target.dataset.fieldKey;
            e.dataTransfer.setData('text/plain', draggedFieldKey); // For Firefox compatibility
        });
    });

    // The following functions are defined outside the DOMContentLoaded but called inside
    // and are already present in the file. Their definitions remain as is.

    // Function to load tables from the database
    async function loadTables() {
        console.log('Attempting to load tables...');
        try {
            const response = await fetch('get_tables.php');
            const result = await response.json();

            if (result.error) {
                console.error('Error loading tables:', result.error);
                alert('Could not load tables from the database: ' + result.error);
                return;
            }

            allTableNames = result.tables || [];
            console.log('Tables loaded:', allTableNames);
            renderTableOptions(allTableNames);

        } catch (error) {
            console.error('Error fetching tables:', error);
            alert('An error occurred while fetching table names.');
        }
    }

    // Function to render table options in the select dropdown
    function renderTableOptions(tables) {
        tableSelector.innerHTML = '<option value="">-- Select a table --</option>';
        tables.forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            tableSelector.appendChild(option);
        });
        console.log('Table options rendered.', tables.length, 'options.');
    }

    // Render sheet buttons
    function renderSheetButtons(sheetNames) {
        sheetButtonsContainer.innerHTML = '';
        sheetNames.forEach(sheetName => {
            const button = document.createElement('button');
            button.classList.add('sheet-btn');
            button.textContent = sheetName;
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.sheet-btn').forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                button.classList.add('active');
                selectedSheetName = sheetName;
                // Clear previous mappings and preview when sheet changes
                currentSessionTemplate.mapping = {};
                renderExcelColumns(0, {});
                previewTableContainer.classList.add('hidden');
            });
            sheetButtonsContainer.appendChild(button);
        });
        // Automatically select the first sheet if available
        if (sheetNames.length > 0) {
            sheetButtonsContainer.querySelector('.sheet-btn').click();
        }
    }

    // Render Excel Columns for Mapping UI
    function renderExcelColumns(numCols, currentMapping) {
        excelColumnsContainer.innerHTML = '';
        for (let i = 0; i < numCols; i++) {
            const colLetter = getExcelColumnName(i);
            // Find the mapping for this column letter, check for both old string and new object format
            const mappedDetails = currentMapping[colLetter];
            const fieldKey = typeof mappedDetails === 'object' ? mappedDetails.dbField : mappedDetails || '';

            const excelColumnDiv = document.createElement('div');
            excelColumnDiv.classList.add('excel-column', 'p-3', 'border', 'rounded-md', 'bg-gray-100', 'flex', 'flex-col', 'justify-between');
            excelColumnDiv.innerHTML = `
                <div class="font-bold text-gray-700 mb-2">Column ${colLetter}</div>
                <div class="drop-zone border-dashed border-2 border-gray-400 p-4 rounded-md text-gray-600 flex items-center justify-center min-h-[50px]">
                    ${fieldKey ? `<span class="mapped-field">${fieldKey} <i class="fas fa-times-circle cursor-pointer ml-1 clear-mapping" data-col-letter="${colLetter}"></i></span>` : 'Drag & Drop Field Here'}
                </div>
            `;
            excelColumnsContainer.appendChild(excelColumnDiv);

            // If there's a mapping for this column, render FK options
            if (typeof mappedDetails === 'object') {
                renderForeignKeyOptionsUI(excelColumnDiv, colLetter, mappedDetails);
            }
        }
        addDropZoneListeners();
        addClearMappingListeners();
    }

    // Render Preview Table
    function renderPreviewTable(headers, dataRows) {
        previewTableContainer.classList.remove('hidden');
        const thead = previewTable.querySelector('thead tr');
        const tbody = previewTable.querySelector('tbody');

        thead.innerHTML = '';
        tbody.innerHTML = '';

        // Render Headers
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            thead.appendChild(th);
        });

        // Render Data Rows (limit to first N rows for preview)
        const displayRows = dataRows.slice(0, 5); // Display first 5 rows
        displayRows.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                // Apply date formatting for display
                td.textContent = formatDateForMySQL(cell);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        if (dataRows.length > displayRows.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.setAttribute('colspan', headers.length);
            td.textContent = `... and ${dataRows.length - displayRows.length} more rows.`;
            td.classList.add('text-center', 'italic', 'text-gray-500');
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
    }

    function addDropZoneListeners() {
        document.querySelectorAll('.drop-zone').forEach(dropZone => {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('hover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('hover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('hover');

                const fieldKey = draggedFieldKey || e.dataTransfer.getData('text/plain');
                if (fieldKey) {
                    const columnDiv = dropZone.closest('.excel-column');
                    const colLetter = columnDiv.querySelector('.font-bold').textContent.replace('Column ', '');

                    // Clear any existing mapping for this colLetter or fieldKey
                    for (const key in currentSessionTemplate.mapping) {
                        // If an existing mapping uses this fieldKey, clear it
                        if (typeof currentSessionTemplate.mapping[key] === 'object' && currentSessionTemplate.mapping[key].dbField === fieldKey) {
                            delete currentSessionTemplate.mapping[key];
                        } else if (currentSessionTemplate.mapping[key] === fieldKey) { // For old string format
                            delete currentSessionTemplate.mapping[key];
                        }
                        // If an existing mapping is for this colLetter, clear it
                        if (key === colLetter) {
                            delete currentSessionTemplate.mapping[key];
                        }
                    }
                    
                    // Set the new mapping as an object
                    currentSessionTemplate.mapping[colLetter] = { dbField: fieldKey, isForeignKey: false };

                    dropZone.innerHTML = `<span class="mapped-field">${fieldKey} <i class="fas fa-times-circle cursor-pointer ml-1 clear-mapping" data-col-letter="${colLetter}"></i></span>`;
                    // Dynamically add foreign key mapping options
                    renderForeignKeyOptionsUI(columnDiv, colLetter, currentSessionTemplate.mapping[colLetter]);
                    addClearMappingListeners(); // Re-add listener for the new clear button
                }
            });
        });
    }

    function addClearMappingListeners() {
        document.querySelectorAll('.clear-mapping').forEach(clearBtn => {
            clearBtn.addEventListener('click', (e) => {
                const colLetter = e.target.dataset.colLetter;
                if (currentSessionTemplate.mapping[colLetter]) {
                    delete currentSessionTemplate.mapping[colLetter];
                    const dropZone = e.target.closest('.drop-zone');
                    if (dropZone) {
                        dropZone.innerHTML = 'Drag & Drop Field Here';
                    }
                }
            });
        });
    }

    // Template Management (localStorage)
    function saveTemplates() {
        localStorage.setItem('importTemplates', JSON.stringify(importTemplates));
    }

    function loadTemplates() {
        const storedTemplates = localStorage.getItem('importTemplates');
        if (storedTemplates) {
            importTemplates = JSON.parse(storedTemplates);
        } else {
            importTemplates = [];
        }
        renderTemplateSelector();
    }

    function renderTemplateSelector() {
        templateSelector.innerHTML = '<option value="">Load Template</option>';
        importTemplates.forEach((template, index) => {
            const option = document.createElement('option');
            option.value = index; // Use index as value for simplicity
            option.textContent = template.name;
            templateSelector.appendChild(option);
        });
        // Show/hide delete button based on selection
        deleteTemplateBtn.classList.add('hidden');
    }

    templateSelector.addEventListener('change', (e) => {
        const index = e.target.value;
        if (index !== "") {
            currentSessionTemplate = JSON.parse(JSON.stringify(importTemplates[index])); // Deep copy
            // Update UI based on loaded template
            // This requires re-rendering excel columns with the loaded mapping
            // First, get the number of excel columns from the current preview or input range
            const startCol = document.getElementById('rangeStartCol').value.toUpperCase();
            const endCol = document.getElementById('rangeEndCol').value.toUpperCase();
            if (startCol && endCol) {
                const numCols = colLetterToIndex(endCol) - colLetterToIndex(startCol) + 1;
                renderExcelColumns(numCols, currentSessionTemplate.mapping);
            } else {
                alert('Please define a range before loading a template.');
                templateSelector.value = ""; // Reset selector
                return;
            }
            deleteTemplateBtn.classList.remove('hidden');
        } else {
            // No template selected, reset current session template and hide delete button
            currentSessionTemplate = { name: "New Template", mapping: {} };
            // Clear mappings in UI
            const startCol = document.getElementById('rangeStartCol').value.toUpperCase();
            const endCol = document.getElementById('rangeEndCol').value.toUpperCase();
            if (startCol && endCol) {
                const numCols = colLetterToIndex(endCol) - colLetterToIndex(startCol) + 1;
                renderExcelColumns(numCols, {});
            }
            deleteTemplateBtn.classList.add('hidden');
        }
    });

    saveTemplateBtn.addEventListener('click', () => {
        const templateName = prompt('Enter a name for this import template:', currentSessionTemplate.name);
        if (templateName) {
            currentSessionTemplate.name = templateName;
            const existingIndex = importTemplates.findIndex(t => t.name === templateName);
            if (existingIndex > -1) {
                importTemplates[existingIndex] = JSON.parse(JSON.stringify(currentSessionTemplate)); // Update existing
            } else {
                importTemplates.push(JSON.parse(JSON.stringify(currentSessionTemplate))); // Add new
            }
            saveTemplates();
            renderTemplateSelector();
            alert('Template saved!');
        }
    });

    deleteTemplateBtn.addEventListener('click', () => {
        const index = templateSelector.value;
        if (index !== "" && confirm(`Are you sure you want to delete template "${importTemplates[index].name}"?`)) {
            importTemplates.splice(index, 1);
            saveTemplates();
            loadTemplates(); // Re-render and clear selection
            alert('Template deleted!');
            // Reset current session template after deletion
            currentSessionTemplate = { name: "New Template", mapping: {} };
            // Clear mappings in UI
            const startCol = document.getElementById('rangeStartCol').value.toUpperCase();
            const endCol = document.getElementById('rangeEndCol').value.toUpperCase();
            if (startCol && endCol) {
                const numCols = colLetterToIndex(endCol) - colLetterToIndex(startCol) + 1;
                renderExcelColumns(numCols, {});
            }
        }
    });

    // Run Importer
    importerBtn.addEventListener('click', async () => {
        if (!workbook || !selectedSheetName) {
            alert('Please select a file and a sheet first.');
            return;
        }

        if (Object.keys(currentSessionTemplate.mapping).length === 0) {
            alert('Please map at least one Excel column to a database field.');
            return;
        }

        const startCol = document.getElementById('rangeStartCol').value.toUpperCase();
        const startRow = document.getElementById('rangeStartRow').value;
        const endCol = document.getElementById('rangeEndCol').value.toUpperCase();
        const endRow = document.getElementById('rangeEndRow').value;
        const rangeStr = `${startCol}${startRow}:${endCol}${endRow}`;

        const sheet = workbook.Sheets[selectedSheetName];
        let dataRows;
        try {
            dataRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: rangeStr, defval: "", cellDates: true }).slice(1);
        } catch (e) {
            console.error("Error reading range for import:", e);
            alert("Could not re-read the specified range for import. Please check the range and selected sheet.");
            return;
        }

        if (dataRows.length === 0) {
            alert('No data rows found in the specified range for import.');
            return;
        }

        // Prepare data for sending to PHP
        const payload = {
            mapping: currentSessionTemplate.mapping, // Send the full mapping object
            rows: dataRows.map(row => row.map(cell => formatDateForMySQL(cell))),
            targetTable: tableSelector.value // Add the selected table name to the payload
        };

        try {
            const response = await fetch('import_clients.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.error) {
                alert(`Import failed: ${result.error}`);
            } else {
                let message = `Import completed!\nInserted: ${result.inserted}\nFailed: ${result.failed}`;
                if (result.errorCsv) {
                    message += `\nErrors saved to: ${result.errorCsv}`;
                    if (confirm(message + "\nDo you want to open the error CSV?")) {
                        window.open(result.errorCsv, '_blank');
                    }
                } else {
                    alert(message);
                }
            }
        } catch (error) {
            console.error('Error during import:', error);
            alert('An error occurred during the import process. Check console for details.');
        }
    });

    // Function to fetch and render columns for a selected table
    async function fetchAndRenderColumns(tableName) {
        try {
            const response = await fetch(`get_columns.php?table=${tableName}`);
            const result = await response.json();

            if (result.error) {
                console.error('Error loading columns:', result.error);
                alert('Could not load columns for table ' + tableName + ': ' + result.error);
                availableFieldsContainer.innerHTML = '';
                return;
            }

            const columns = result.columns || [];
            console.log('Columns for ' + tableName + ':', columns);
            renderAvailableFields(columns);

        } catch (error) {
            console.error('Error fetching columns:', error);
            alert('An error occurred while fetching column names for the table.');
        }
    }

    // Function to render available database fields
    function renderAvailableFields(columns) {
        availableFieldsContainer.innerHTML = ''; // Clear existing fields
        if (columns.length === 0) {
            availableFieldsContainer.innerHTML = '<p class="text-gray-500">No columns found for this table.</p>';
            return;
        }

        columns.forEach(columnName => {
            // Exclude the 'id' column, but include foreign keys like 'id_client'
            if (columnName === 'id') {
                return; // Skip this column
            }
            const span = document.createElement('span');
            span.classList.add('draggable-field');
            span.setAttribute('draggable', 'true');
            span.dataset.fieldKey = columnName; // Use column name as field key
            span.textContent = columnName;
            availableFieldsContainer.appendChild(span);
        });
        // Re-add draggable listeners as new elements are added
        document.querySelectorAll('.draggable-field').forEach(field => {
            field.addEventListener('dragstart', (e) => {
                draggedFieldKey = e.target.dataset.fieldKey;
                e.dataTransfer.setData('text/plain', draggedFieldKey); // For Firefox compatibility
            });
        });
    }

    // New function to render foreign key mapping UI
    async function renderForeignKeyOptionsUI(columnDiv, colLetter, mappingDetails) {
        let fkOptionsDiv = columnDiv.querySelector('.fk-options');
        if (!fkOptionsDiv) {
            fkOptionsDiv = document.createElement('div');
            fkOptionsDiv.classList.add('fk-options', 'mt-2', 'p-2', 'border', 'rounded-md', 'bg-gray-50');
            columnDiv.appendChild(fkOptionsDiv);
        }
        fkOptionsDiv.innerHTML = `
            <label class="flex items-center text-sm font-medium text-gray-700 mb-1">
                <input type="checkbox" class="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out is-fk-checkbox"
                    ${mappingDetails.isForeignKey ? 'checked' : ''} data-col-letter="${colLetter}">
                <span class="ml-2">Is Foreign Key?</span>
            </label>
            <div class="fk-details ${!mappingDetails.isForeignKey ? 'hidden' : ''}">
                <label for="lookupTable-${colLetter}" class="block text-sm font-medium text-gray-700">Lookup Table:</label>
                <select id="lookupTable-${colLetter}" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md lookup-table-select" data-col-letter="${colLetter}">
                    <option value="">-- Select Table --</option>
                </select>
                <label for="lookupColumn-${colLetter}" class="block text-sm font-medium text-gray-700 mt-2">Lookup Column:</label>
                <select id="lookupColumn-${colLetter}" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md lookup-column-select" data-col-letter="${colLetter}">
                    <option value="">-- Select Column --</option>
                </select>
            </div>
        `;

        // Populate lookup tables dropdown
        const lookupTableSelect = fkOptionsDiv.querySelector(`.lookup-table-select[data-col-letter="${colLetter}"]`);
        allTableNames.forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            lookupTableSelect.appendChild(option);
        });
        if (mappingDetails.lookupTable) {
            lookupTableSelect.value = mappingDetails.lookupTable;
            // If a lookup table is pre-selected, fetch its columns
            await fetchAndRenderLookupColumns(mappingDetails.lookupTable, colLetter, mappingDetails.lookupColumn);
        }

        // Add event listeners
        fkOptionsDiv.querySelector(`.is-fk-checkbox[data-col-letter="${colLetter}"]`).addEventListener('change', (e) => {
            mappingDetails.isForeignKey = e.target.checked;
            fkOptionsDiv.querySelector('.fk-details').classList.toggle('hidden', !e.target.checked);
            // Clear lookup details if checkbox is unchecked
            if (!e.target.checked) {
                delete mappingDetails.lookupTable;
                delete mappingDetails.lookupColumn;
                fkOptionsDiv.querySelector(`.lookup-table-select[data-col-letter="${colLetter}"]`).value = "";
                fkOptionsDiv.querySelector(`.lookup-column-select[data-col-letter="${colLetter}"]`).innerHTML = '<option value="">-- Select Column --</option>';
            }
        });

        lookupTableSelect.addEventListener('change', async (e) => {
            mappingDetails.lookupTable = e.target.value;
            // Reset lookup column when lookup table changes
            mappingDetails.lookupColumn = undefined;
            await fetchAndRenderLookupColumns(e.target.value, colLetter, mappingDetails.lookupColumn);
        });

        fkOptionsDiv.querySelector(`.lookup-column-select[data-col-letter="${colLetter}"]`).addEventListener('change', (e) => {
            mappingDetails.lookupColumn = e.target.value;
        });

        // Make sure we have the latest `allTableNames` when rendering these options.
        // If `loadTables()` hasn't completed yet, this might be empty.
        // Consider ensuring `loadTables()` completes before modal is fully interactive.
    }

    // New function to fetch and render columns for a lookup table
    async function fetchAndRenderLookupColumns(tableName, colLetter, selectedLookupColumn) {
        const lookupColumnSelect = document.querySelector(`.lookup-column-select[data-col-letter="${colLetter}"]`);
        lookupColumnSelect.innerHTML = '<option value="">-- Select Column --</option>'; // Clear previous options

        if (!tableName) {
            return; // No table selected
        }

        try {
            const response = await fetch(`get_columns.php?table=${tableName}`); // Reuse get_columns.php
            const result = await response.json();

            if (result.error) {
                console.error('Error loading lookup columns:', result.error);
                return;
            }

            const columns = result.columns || [];
            columns.forEach(columnName => {
                const option = document.createElement('option');
                option.value = columnName;
                option.textContent = columnName;
                lookupColumnSelect.appendChild(option);
            });

            if (selectedLookupColumn) {
                lookupColumnSelect.value = selectedLookupColumn;
            }

        } catch (error) {
            console.error('Error fetching lookup columns:', error);
        }
    }

    // Initial load
    loadTemplates();
});
