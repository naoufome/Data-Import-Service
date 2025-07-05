<?php
header('Content-Type: application/json');

// Error reporting for development
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database connection details - ENSURE THESE MATCH import_clients.php
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

$tables = [];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);

    // Fetch all table names from the current database
    $stmt = $pdo->query('SHOW TABLES');
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }

    echo json_encode(['tables' => $tables]);

} catch (PDOException $e) {
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit();
} catch (Exception $e) {
    echo json_encode(['error' => 'General error: ' . $e->getMessage()]);
    exit();
}

?> 