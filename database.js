const mysql = require('mysql2');
// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',    // Replace with your MySQL host
    user: 'root',         // Replace with your MySQL user
    password: '', // Replace with your MySQL password
    database: 'sayyar_bus',  // Replace with your database name

});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});


module.exports = db;
