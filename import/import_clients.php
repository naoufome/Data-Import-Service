<?php
header('Content-Type: application/json');

// Error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$data = json_decode(file_get_contents('php://input'), true);

$mapping = $data['mapping'] ?? [];
$rows = $data['rows'] ?? [];
$targetTable = $data['targetTable'] ?? ''; // Get the target table name from the payload

$insertedCount = 0;
$failedCount = 0;
$errors = [];
$errorCsvPath = null;

// Database connection details
$host = 'localhost';
$db = 'vitaSante'; // <<< IMPORTANT: Change to your database name
$user = 'root';   // <<< IMPORTANT: Change to your database user
$pass = 'naoufomi';       // <<< IMPORTANT: Change to your database password
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

// Helper function to convert Excel column letter to 0-indexed number
function colLetterToIndex($letter) {
    $column = 0;
    $length = strlen($letter);
    for ($i = 0; $i < $length; $i++) {
        $column += (ord($letter[$i]) - 64) * pow(26, $length - $i - 1);
    }
    return $column - 1; // 0-indexed
}

// New helper function to perform foreign key lookup
function getForeignKeyId($pdo, $lookupTable, $lookupColumn, $value) {
    // Sanitize table and column names to prevent SQL injection
    // (assuming table/column names are fetched from trusted source or strictly validated)
    $lookupTable = preg_replace('/[^a-zA-Z0-9_]/m', '', $lookupTable);
    $lookupColumn = preg_replace('/[^a-zA-Z0-9_]/m', '', $lookupColumn);

    if (empty($lookupTable) || empty($lookupColumn) || $value === null || $value === '') {
        return null; // Cannot perform lookup without full details or a value
    }

    $sql = "SELECT id FROM `" . $lookupTable . "` WHERE `" . $lookupColumn . "` = :value";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['value' => $value]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    return $result ? $result['id'] : null; // Return ID or NULL if not found
}

try {
    $pdo = new PDO($dsn, $user, $pass, $options);

    if (empty($mapping)) {
        throw new Exception('No column mapping provided.');
    }

    if (empty($targetTable)) {
        throw new Exception('No target table selected for import.');
    }

    // Sanitize target table name to prevent SQL injection
    $targetTable = preg_replace('/[^a-zA-Z0-9_]/m', '', $targetTable);
    if (empty($targetTable)) {
        throw new Exception('Invalid target table name provided.');
    }

    // Extract database fields and prepare for SQL statement, considering new mapping structure
    $dbFields = [];
    foreach ($mapping as $excelColLetter => $mapDetails) {
        if (is_array($mapDetails) && isset($mapDetails['dbField'])) {
            $dbFields[] = $mapDetails['dbField'];
        } else {
            // Handle old string format mapping for backward compatibility if needed, though frontend sends new format now
            $dbFields[] = $mapDetails; 
        }
    }

    if (empty($dbFields)) {
        throw new Exception('No valid database fields found in mapping.');
    }

    $placeholders = array_map(function($field){ return ":$field"; }, $dbFields);

    // Use the dynamic targetTable in the INSERT statement
    $sql = "INSERT INTO `" . $targetTable . "` (" . implode(', ', $dbFields) . ") VALUES (" . implode(', ', $placeholders) . ")";
    $stmt = $pdo->prepare($sql);

    $pdo->beginTransaction();

    foreach ($rows as $rowIndex => $row) {
        $params = [];
        $currentRowErrors = [];
        $hasErrorInRow = false;

        foreach ($mapping as $excelColLetter => $mapDetails) {
            $colIndex = colLetterToIndex($excelColLetter);
            $dbField = is_array($mapDetails) ? $mapDetails['dbField'] : $mapDetails;
            $excelValue = $row[$colIndex] ?? null; // Use null coalescing operator

            if (is_array($mapDetails) && isset($mapDetails['isForeignKey']) && $mapDetails['isForeignKey'] === true) {
                // Perform foreign key lookup
                $lookupTable = $mapDetails['lookupTable'] ?? null;
                $lookupColumn = $mapDetails['lookupColumn'] ?? null;
                $foreignId = getForeignKeyId($pdo, $lookupTable, $lookupColumn, $excelValue);
                $params[":$dbField"] = $foreignId; // Assign the looked-up ID or NULL
            } else {
                $params[":$dbField"] = $excelValue;
            }
        }

        try {
            $stmt->execute($params);
            $insertedCount++;
        } catch (PDOException $e) {
            $hasErrorInRow = true;
            $failedCount++;
            $errorMessage = $e->getMessage();
            $errors[] = array_merge(['row' => $rowIndex + 2, 'error' => $errorMessage], $row); // +2 for 1-indexed row and header
            // Log error for this row but continue with others
            error_log("Database insert error on row " . ($rowIndex + 2) . ": " . $errorMessage);
        }
    }

    $pdo->commit();

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['error' => $e->getMessage()]);
    exit();
}

// If there are any failures, write them to a CSV
if (!empty($errors)) {
    if (!is_dir('logs')) {
        mkdir('logs', 0777, true);
    }
    $timestamp = date('Ymd_His');
    $errorCsvPath = "logs/errors_{$timestamp}.csv";
    
    $output = fopen($errorCsvPath, 'w');
    
    // CSV Header
    // Ensure headers are correctly generated, especially if $rows[0] is not always present
    $csvHeader = ['row', 'error'];
    if (!empty($rows)) {
        $csvHeader = array_merge($csvHeader, array_keys($rows[0]));
    } else if (!empty($errors)) {
        // Fallback: if rows is empty but errors exist, try to get keys from an error row
        $firstErrorRowKeys = array_keys($errors[0]);
        // Remove 'row' and 'error' which are prepended
        $excelDataKeys = array_diff($firstErrorRowKeys, ['row', 'error']);
        $csvHeader = array_merge($csvHeader, $excelDataKeys);
    }

    fputcsv($output, $csvHeader);

    // CSV Data
    foreach ($errors as $errorRow) {
        // Ensure the order of columns matches the header
        $rowData = [$errorRow['row'], $errorRow['error']];
        foreach ($csvHeader as $headerCol) {
            if ($headerCol !== 'row' && $headerCol !== 'error') {
                $rowData[] = $errorRow[$headerCol] ?? ''; // Add corresponding Excel data
            }
        }
        fputcsv($output, $rowData);
    }
    fclose($output);
}

echo json_encode([
    'inserted' => $insertedCount,
    'failed' => $failedCount,
    'errorCsv' => $errorCsvPath
]);

?> 