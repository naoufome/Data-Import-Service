# Data Import Service

## Overview

This Data Import Service is a web-based tool designed to facilitate the efficient and accurate import of data from Excel spreadsheets into a MySQL database. It provides a user-friendly interface for mapping Excel columns to database fields, previewing data, and handling complex data scenarios like foreign key relationships.

## Key Features

*   **Excel File Upload & Sheet Selection**: Easily upload `.xlsx` files and select the desired sheet for import.
*   **Data Range Definition & Preview**: Define specific ranges within your Excel sheet for import and instantly preview the data to ensure correctness.
*   **Dynamic Column Mapping**: Visually drag and drop database fields onto corresponding Excel columns to define your data mapping. This flexible system adapts to various Excel layouts.
*   **Advanced Foreign Key Lookup**:
    *   **Intelligent ID Resolution**: Automatically translates human-readable values from Excel (e.g., "Marketing Department") into their corresponding numeric foreign key IDs in the database.
    *   **Configurable Lookups**: For each foreign key, specify the exact lookup table and the column within that table to use for the value-to-ID translation.
    *   **Graceful Error Handling**: If a foreign key value from Excel is not found in the lookup table, the system will insert a `NULL` value into the target database column, preventing import failures (configurable behavior).
*   **Comprehensive Error Reporting**: Failed import rows are logged to a detailed CSV file, making it easy to identify and correct data issues.

## Who Will Benefit?

This service is ideal for:

*   **Data Administrators**: Streamline the process of migrating or updating data from external sources into your relational database.
*   **Businesses with External Data**: Companies that regularly receive data in Excel format from clients, partners, or legacy systems can automate and simplify their import workflows.
*   **Developers**: Provides a robust foundation for building data import functionalities with clear separation of frontend and backend logic.
*   **Anyone Needing Data Sync**: Users who need to synchronize data between Excel reports and their database without manual data entry or complex scripting.

## Setup and Prerequisites

This service is built using a classic LAMP/XAMPP stack.

*   **Web Server**: Apache (e.g., via XAMPP)
*   **Database**: MySQL (configured with your database name, user, and password)
*   **Backend Language**: PHP
*   **Frontend Technologies**: HTML, CSS (TailwindCSS for styling), JavaScript (with XLSX.js for Excel parsing).

### Configuration

1.  **Database Connection**: Ensure the `$db`, `$user`, and `$pass` variables in `import/import_clients.php` and `import/get_columns.php` are correctly configured to match your MySQL database credentials.
    ```php
    // import/import_clients.php & import/get_columns.php
    $host = 'localhost';
    $db = 'your_database_name'; // <<< IMPORTANT: Change this
    $user = 'your_db_user';   // <<< IMPORTANT: Change this
    $pass = 'your_db_password';       // <<< IMPORTANT: Change this
    ```
2.  **File Structure**:
    *   `import/index.html`: The main user interface for the import tool.
    *   `import/assets/import.js`: Frontend JavaScript logic, including UI interactions, Excel parsing, and data mapping.
    *   `import/get_tables.php`: PHP script to fetch available table names from the database.
    *   `import/get_columns.php`: PHP script to fetch column names for a given table.
    *   `import/import_clients.php`: PHP script handling the core import logic, including data insertion and foreign key lookups.
    *   `import/logs/`: Directory for error CSV files (will be created automatically if it doesn't exist).

## How to Use

1.  **Access the Tool**: Open `import/index.html` in your web browser (e.g., `http://localhost/your_project_folder/import/index.html`).
2.  **Open Import Modal**: Click the "Open Import" button to launch the import modal.
3.  **Select Target Table**: From the "Choose Table" dropdown, select the database table where you want to import your data.
4.  **Upload Excel File**: Click "Choose File" and select your Excel spreadsheet (`.xlsx`).
5.  **Select Sheet**: After uploading, click on the desired sheet name to activate it.
6.  **Define Import Range**:
    *   Enter the starting Excel column (e.g., `A`) and row (e.g., `1`).
    *   Enter the ending Excel column (e.g., `C`) and row (e.g., `10`).
    *   Click "Preview Range" to see a snapshot of your data. The first row of your range should typically be your headers.
7.  **Map Excel Columns to Database Fields**:
    *   On the left, you'll see "Available Database Fields" for your selected table.
    *   On the right, "Excel Columns" corresponding to your previewed range will appear.
    *   **Drag and Drop**: Drag each database field from the left onto its corresponding Excel column on the right.
    *   **Configure Foreign Keys**:
        *   For fields that are foreign keys (e.g., `department_id` mapped to an Excel column with "Marketing"), check the "Is Foreign Key?" checkbox.
        *   Select the **Lookup Table** (e.g., `departments`) where the foreign key's human-readable value is stored.
        *   Select the **Lookup Column** (e.g., `name`) within the lookup table that contains the human-readable value.
8.  **Save/Load Templates (Optional)**:
    *   If you have a recurring import with the same mapping, you can click "Save Template" to store your current mapping.
    *   Use the "Load Template" dropdown to quickly apply a saved mapping.
    *   Delete old templates with "Delete Template".
9.  **Run Importer**: Once your mappings are complete and foreign keys configured, click "Run Importer".
    *   A success message will show inserted and failed rows.
    *   If there are failures, a CSV file with error details will be generated in the `logs/` directory, and you'll be prompted to open it.

## Future Enhancements (Ideas)

*   **Advanced Data Validation**: Implement more robust validation rules (e.g., data types, uniqueness checks) before insertion.
*   **Duplicate Handling**: Options for handling duplicate records (e.g., skip, update existing).
*   **Batch Processing**: For very large files, implement server-side batch processing to prevent timeouts.
*   **UI/UX Improvements**: Further refine the user interface for even greater clarity and ease of use. 