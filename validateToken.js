const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load .env file contents into process.env
const SECRET_KEY = process.env.SECRET_KEY; // Make sure SECRET_KEY is stored in .env
//const SECRET_KEY = 'your-secret-key'; // Replace with an environment variable in production
// Middleware function to validate JWT token
const validateToken = (req, res, next) => {
    // Get the token from the request header
    const token = req.headers['authorization'];

    // Check if the token exists
    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        // Verify the token using SECRET_KEY
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // Attach user information from token payload to the request object
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
    } catch (err) {
        // Handle invalid or expired token
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

module.exports = validateToken;
