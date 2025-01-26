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
const nodemailer = require("nodemailer");
const timeout = require('connect-timeout');

// Add timeout middleware
app.use(timeout('1m')); // Set timeout to 3 minutes
app.use((req, res, next) => {
    if (!req.timedout) next();
});


app.use(express.json());
app.use(helmet()); // Set security headers
app.use(cors()); // Enable CORS for your API

// Basic rate limiting to prevent DDoS attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
});
app.use(limiter);


// Send Beautiful OTP Email
async function sendBeautifulOTP(email, otp) {

s// Create a transporter object with Zoho SMTP settings
const transporter = nodemailer.createTransport({
host: "smtp.zoho.com",
port: 465, // Use 587 for TLS
secure: true, // Use true for SSL, false for TLS
auth: {
  user: "careers@sayyar.om", // Your Zoho email
  pass: "gqy2gNh$$", // Your Zoho email password
},
});

  // Define the email content with a beautiful HTML design
const mailOptions = {
  from: '"Sayyar Service" <careers@sayyar.om>', // Sender address
  to: email, // Recipient email address
  subject: "Error with Sayyar Service", // Email subject
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
      <h2 style="color: #d9534f; text-align: center;">Service Error</h2>
      <p>Dear User,</p>
      <p>We encountered an error while processing your request. Our team has been notified, and we are working to resolve the issue as soon as possible.</p>
      <p>If this issue persists, please contact our support team for further assistance.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="text-align: center; font-size: 12px; color: #999;">Sayyar Team | <a href="https://sayyar.om" style="color: #51727b; text-decoration: none;">www.sayyar.om</a></p>
    </div>
  `,
};


      try {
        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log("OTP email sent successfully:", info.response);
      } catch (error) {
        console.error("Error sending OTP email:", error);
        throw error;
      }
}


// Route: POST /send-error-emails
app.post("/send-error-emails", validateToken,(req, res) => {
    const querySelect = "SELECT email FROM login";

    db.query(querySelect, async (err, result) => {
        if (err) {
            return res.status(500).json({ message: "Database error during fetching emails", error: err.sqlMessage });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ message: "No emails found in the login table" });
        }

        try {
            // Extract emails into a single array
            const emailList = result.map((user) => user.email).join(',');

            // Create a transporter object with Zoho SMTP settings
            const transporter = nodemailer.createTransport({
                host: "smtp.zoho.com",
                port: 465, // Use 587 for TLS
                secure: true, // Use true for SSL, false for TLS
                auth: {
                    user: "careers@sayyar.om", // Your Zoho email
                    pass: "gqy2gNh$$", // Your Zoho email password
                },
            });

            // Combine all emails into one request
            const mailOptions = {
                from: '"Sayyar Service" <careers@sayyar.om>', // Sender address
                bcc: emailList, // All recipient emails separated by commas
                subject: "Service Error Notification", // Email subject
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
                        <h2 style="color: #d9534f; text-align: center;">Service Error</h2>
                        <p>Dear Users,</p>
                        <p>We encountered an issue while processing your request. Our team is aware of the problem and is working to resolve it as quickly as possible.</p>
                        <p>If you have any urgent concerns, please contact our support team at <a href="mailto:support@sayyar.om" style="color: #51727b;">support@sayyar.om</a>.</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                        <p style="text-align: center; font-size: 12px; color: #999;">Sayyar Team | <a href="https://sayyar.om" style="color: #51727b; text-decoration: none;">www.sayyar.om</a></p>
                    </div>
                `,
            };

            // Send the email to all recipients
            await transporter.sendMail(mailOptions);
            console.log("Error emails sent successfully to all recipients!");

            res.status(200).json({ message: "Error emails sent successfully!" });
        } catch (emailError) {
            console.error("Error sending emails:", emailError);
            res.status(500).json({ message: "Failed to send error emails", error: emailError.message });
        }
    });
});








// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    sendBeautifulOTP("omxqn12@gmail.com", "Something wrong with server")
              .then(() => console.log("Email ERROR Sent"))
              .catch((error) => console.error("Something went wrong!", error));
    
    
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










