<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel to Database Importer</title>
    <!-- Font-Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <!-- Google Fonts Poppins -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Tailwind CDN -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Poppins', sans-serif;
            background-color: #f0f2f5;
        }
        .modal-overlay {
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 999;
        }
        .modal-content {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        }
        .sheet-btn {
            padding: 8px 15px;
            border-radius: 5px;
            margin-right: 10px;
            margin-bottom: 10px;
            background-color: #e2e8f0;
            color: #2d3748;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .sheet-btn.active, .sheet-btn:hover {
            background-color: #4299e1;
            color: #ffffff;
        }
        .draggable-field {
            padding: 8px 12px;
            background-color: #a0aec0;
            color: #ffffff;
            border-radius: 5px;
            margin-bottom: 8px;
            cursor: grab;
            font-size: 0.9em;
            display: inline-block;
            margin-right: 5px;
        }
        .draggable-field.required {
            background-color: #dd6b20;
        }
        .excel-column {
            background-color: #edf2f7;
            border: 1px solid #cbd5e0;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
            text-align: center;
            min-height: 80px; /* Ensure drop zone is visible */
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .drop-zone {
            border: 2px dashed #a0aec0;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
            min-height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #718096;
            font-size: 0.9em;
        }
        .drop-zone.hover {
            background-color: #ebf8ff;
            border-color: #4299e1;
        }
        .mapped-field {
            background-color: #48bb78;
            color: #ffffff;
            padding: 5px 10px;
            border-radius: 3px;
            margin-top: 5px;
            display: inline-block;
        }
        .preview-table-container {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            margin-top: 15px;
        }
        .preview-table {
            width: 100%;
            border-collapse: collapse;
        }
        .preview-table th, .preview-table td {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .preview-table th {
            background-color: #f7fafc;
            font-weight: 600;
            color: #2d3748;
        }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen">

    <button id="openModalBtn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Open Importer
    </button>

    <div id="importModal" class="modal-overlay fixed inset-0 flex items-center justify-center hidden">
        <div class="modal-content p-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Excel to Database Importer</h2>

            <!-- Section 1: Select File & Sheet -->
            <section class="mb-8 p-6 border rounded-lg shadow-sm bg-gray-50">
                <h3 class="text-xl font-semibold text-gray-700 mb-4"><i class="fas fa-file-excel mr-2"></i>Select File & Sheet</h3>
                <input type="file" id="importFileSelector" accept=".xlsx,.xls,.csv" class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none">
                <div id="sheetButtonsContainer" class="mt-4 flex flex-wrap gap-2">
                    <!-- Sheet buttons will be rendered here -->
                </div>
            </section>

            <!-- Section 2: Define Range -->
            <section class="mb-8 p-6 border rounded-lg shadow-sm bg-gray-50">
                <h3 class="text-xl font-semibold text-gray-700 mb-4"><i class="fas fa-arrows-alt mr-2"></i>Define Range (e.g., A1:H10)</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label for="rangeStartCol" class="block text-sm font-medium text-gray-700">Start Column</label>
                        <input type="text" id="rangeStartCol" value="A" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                    </div>
                    <div>
                        <label for="rangeStartRow" class="block text-sm font-medium text-gray-700">Start Row</label>
                        <input type="number" id="rangeStartRow" value="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                    </div>
                    <div>
                        <label for="rangeEndCol" class="block text-sm font-medium text-gray-700">End Column</label>
                        <input type="text" id="rangeEndCol" value="H" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                    </div>
                    <div>
                        <label for="rangeEndRow" class="block text-sm font-medium text-gray-700">End Row</label>
                        <input type="number" id="rangeEndRow" value="10" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                    </div>
                </div>
                <button id="previewRangeBtn" class="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out">
                    <i class="fas fa-eye mr-2"></i>Preview Range
                </button>
            </section>

            <!-- Section 2.5: Select Target Table -->
            <section class="mb-8 p-6 border rounded-lg shadow-sm bg-gray-50">
                <h3 class="text-xl font-semibold text-gray-700 mb-4"><i class="fas fa-table mr-2"></i>Select Target Table</h3>
                <div class="mb-4">
                    <label for="tableSearch" class="block text-sm font-medium text-gray-700">Search Table</label>
                    <input type="text" id="tableSearch" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" placeholder="Type to search tables...">
                </div>
                <div>
                    <label for="tableSelector" class="block text-sm font-medium text-gray-700">Choose Table</label>
                    <select id="tableSelector" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                        <option value="">-- Select a table --</option>
                    </select>
                </div>
            </section>

            <!-- Section 3: Configure Import Template -->
            <section class="mb-8 p-6 border rounded-lg shadow-sm bg-gray-50">
                <h3 class="text-xl font-semibold text-gray-700 mb-4"><i class="fas fa-cogs mr-2"></i>Configure Import Template</h3>
                <div class="flex flex-col md:flex-row gap-6">
                    <!-- Available Fields -->
                    <div class="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-md">
                        <h4 class="text-lg font-medium text-gray-800 mb-3">Available Database Fields</h4>
                        <div id="availableFields" class="flex flex-wrap gap-2">
                            <!-- These should ideally come from backend/config, but for this exercise, hardcode -->
                            <span class="draggable-field" draggable="true" data-field-key="client_name">Client Name (Required)</span>
                            <span class="draggable-field required" draggable="true" data-field-key="client_email">Client Email (Required)</span>
                            <span class="draggable-field" draggable="true" data-field-key="client_phone">Client Phone</span>
                            <span class="draggable-field" draggable="true" data-field-key="client_address">Client Address</span>
                            <span class="draggable-field" draggable="true" data-field-key="client_city">Client City</span>
                            <span class="draggable-field" draggable="true" data-field-key="client_zip">Client Zip</span>
                            <span class="draggable-field" draggable="true" data-field-key="client_country">Client Country</span>
                            <span class="draggable-field" draggable="true" data-field-key="created_at">Created At</span>
                            <span class="draggable-field" draggable="true" data-field-key="updated_at">Updated At</span>
                        </div>
                    </div>

                    <!-- Excel Columns Container -->
                    <div class="w-full md:w-2/3 p-4 bg-white rounded-lg shadow-md">
                        <h4 class="text-lg font-medium text-gray-800 mb-3">Map Excel Columns to Database Fields</h4>
                        <div id="excelColumnsContainer" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 excel-columns-container">
                            <!-- Excel columns will be rendered here with drop zones -->
                        </div>
                    </div>
                </div>

                <div id="previewTableContainer" class="preview-table-container mt-6 hidden">
                    <h4 class="text-lg font-medium text-gray-800 mb-3">Data Preview</h4>
                    <table id="previewTable" class="preview-table">
                        <thead>
                            <tr></tr>
                        </thead>
                        <tbody>
                            <tr></tr>
                        </tbody>
                    </table>
                </div>

                <div class="mt-6 flex justify-end gap-3">
                    <select id="templateSelector" class="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-200 focus:border-blue-300">
                        <option value="">Load Template</option>
                    </select>
                    <button id="saveTemplateBtn" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out">
                        <i class="fas fa-save mr-2"></i>Save Template
                    </button>
                    <button id="deleteTemplateBtn" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out hidden">
                        <i class="fas fa-trash-alt mr-2"></i>Delete Template
                    </button>
                </div>
            </section>

            <!-- Section 4: Actions -->
            <section class="p-6 border rounded-lg shadow-sm bg-gray-50 flex justify-end gap-4">
                <button id="importerBtn" class="bg-blue-600 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-md text-lg transition duration-150 ease-in-out">
                    <i class="fas fa-database mr-2"></i>Run Importer
                </button>
                <button id="closeModalBtn" class="bg-gray-400 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-md text-lg transition duration-150 ease-in-out">
                    Close
                </button>
            </section>

        </div>
    </div>

    <script src="assets/xlsx.full.min.js"></script>
    <script src="assets/import.js"></script>
</body>
</html> 