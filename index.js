const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid'); // For generating random UUIDs
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load .env file contents into process.env
const SECRET_KEY = process.env.SECRET_KEY; // Make sure SECRET_KEY is stored in .env
const app = express();
const PORT = 8888;
const validateToken = require('./validateToken'); // Import the validation middleware
const db = require('./database')

app.use(express.json());
app.use(helmet()); // Set security headers
app.use(cors()); // Enable CORS for your API

// Basic rate limiting to prevent DDoS attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
});
app.use(limiter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});



app.listen(PORT, () => console.log(`Server is running on https://localhost:${PORT}`));

// Route: GET /main
app.get("/main", validateToken,(req, res) => {
    res.status(200).send({
        background: "test.png",
        placetext: "Welcome to my app",
    });
});



// Route: GET /
app.get("/", (req, res) => {
    const queryInsert = 'SELECT * FROM sliders';
    
    db.query(queryInsert,
            (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error during registration', error: err.sqlMessage });
                }

                res.status(200).json(result);
            });
    
});


// Load routes
app.use('/', require('./trips'));

app.use('/',require('./auth'));

app.use('/',require('./upload'));

app.get('/protected', validateToken, (req, res) => {
    // Access user information from decoded token, e.g., req.user.ID
    
    // do "Authorization" parameter of session token in the headers
    // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJRCI6MSwiaWF0IjoxNzMwMTkwMjg3LCJleHAiOjE3MzAxOTM4ODd9.eu8UjJ32jBGbrnTjL70qkfRssAd6SYJRVO0K-xfxgPY"
    
    res.status(200).json({ message: 'This is a protected route', user: req.user });
});









