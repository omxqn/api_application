const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid'); // For generating random UUIDs
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load .env file contents into process.env
const SECRET_KEY = process.env.SECRET_KEY; // Make sure SECRET_KEY is stored in .env
const app = express();
const PORT = 8888;
const validateToken = require('./validateToken'); // Import the validation middleware
const db = require('./database')
const fs = require('fs');
const path = require('path');


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




// Updating bus location every 10 seconds
cron.schedule('*/10 * * * * *', async () => {
    try {
        const response = await axios.post(`http://localhost:${PORT}/trips/update-locations`);
        console.log('Bus locations updated:', response.data.message);
    } catch (error) {
        console.error('Error updating bus locations:', error.message);
    }
});



// Route: GET /main
app.get("/main", (req, res) => {
  // Retrieve `Text`, `Start_Img`, and `Logo` from `Main_table`
  const query = "SELECT Text, Start_Img, Logo FROM main_table LIMIT 1";

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database query error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No data found in Main_table" });
    }

    const row = results[0];

    // Send response with Base64 data
    res.status(200).json({
      text: row.Text,
      start_img: `data:image/png;base64,${row.Start_Img}`, // Base64 image data
      logo: `data:image/png;base64,${row.Logo}`, // Base64 image data
    });
  });
});





// Function to Update Base64 Data into Database
function updateBase64ImageInDatabase(callback) {
  // Path to the images
  const startImagePath = path.join(__dirname, "images", "background.png");
  const logoImagePath = path.join(__dirname, "images", "logo.png");

  try {
    // Read and convert images to Base64
    const startImgBase64 = fs.readFileSync(startImagePath, { encoding: "base64" });
    const logoBase64 = fs.readFileSync(logoImagePath, { encoding: "base64" });

    // Update Base64 data into Main_table where ID = 1
    const updateQuery = `
      UPDATE main_table 
      SET Start_Img = ?, Logo = ? 
      WHERE ID = 1
    `;

    db.query(updateQuery, [startImgBase64, logoBase64], (err, result) => {
      if (err) {
        console.error("Error updating Base64 data in database:", err);
        if (callback) return callback(err, null);
      } else {
        console.log("Base64 data updated in database successfully.");
        if (callback) return callback(null, result);
      }
    });
  } catch (error) {
    console.error("Error reading images:", error);
    if (callback) return callback(error, null);
  }
}

// POST route to update Base64 data in the database
app.post("/main", (req, res) => {
  updateBase64ImageInDatabase((err, result) => {
    if (err) {
      return res.status(500).json({ message: "Error updating data", error: err.message });
    }

    res.status(200).json({ message: "Base64 data updated successfully." });
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










