const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;
const db = require('./database'); // Make sure to import your database connection

// Middleware to validate the token and check it against the database
function validateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify the token
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token.' });
        }

        const userId = decoded.ID;

        // Check if the token exists in the database for the user
        const query = `SELECT token FROM login WHERE ID = ?`;
        db.query(query, [userId], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length === 0 || results[0].token !== token) {
                return res.status(401).json({ message: 'Token not found or does not match.' });
            }

            // Token is valid and matches the database record
            req.user = decoded;
            next();
        });
    });
}

module.exports = validateToken;
