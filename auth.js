const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const validateToken = require('./validateToken'); // Import the validation middleware
const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;
const nodemailer = require("nodemailer");
const axios = require('axios');
const requireRole = require('./systemRoles'); 



async function sendWhatsAppOtp(phoneNumber, otp, apiKey) {
    const url = `https://graph.facebook.com/v21.0/527453130457868/messages`;

    const messageData = {
        messaging_product: 'whatsapp',
        to: phoneNumber, // Recipient's phone number in E.164 format (e.g., +1234567890)
        type: 'template',
        template: {
            name: 'otp', // Replace with your approved template name
            language: { code: 'ar' }, // Replace with the appropriate language code
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: otp.slice(0,5) }, // Replace {{1}} in the template                       
                    ],
                },
                {
                    type: 'button',
                    sub_type: 'url', // Change to 'url' if using a URL button
                    index: 0,
                    parameters: [
                        { type: 'text', text: otp.slice(0,5) }, // Replace {{1}} in the template
                    ],
                },
            ],
        },
    };

    try {
        const response = await axios.post(url, messageData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`Message sent successfully to ${phoneNumber}:`, response.data);
        return response.data;
    } catch (error) {
        console.error(
            `Failed to send message to ${phoneNumber}:`,
            error.response?.data || error.message
        );
        return null;
    }
}



            
            
// Send Beautiful OTP Email
async function sendBeautifulOTP(email, otp) {
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

  // Define the email content with a beautiful HTML design
  const mailOptions = {
    from: '"Sayyar OTP Service" <careers@sayyar.om>', // Sender address
    to: email, // Recipient email address
    subject: "Your One-Time Password (OTP)", // Email subject
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
        <h2 style="color: #51727b; text-align: center;">Your OTP Code</h2>
        <p>Dear User,</p>
        <p>We received a request to verify your email address for your Sayyar account. Use the OTP code below to complete the verification process:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #333; padding: 10px 20px; border: 2px dashed #51727b; display: inline-block; border-radius: 8px;">${otp}</span>
        </div>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p style="text-align: center; font-size: 14px; color: #777;">This OTP is valid for 10 minutes.</p>
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




router.post(
    '/register/user',
    [
        body('username').notEmpty().trim().escape().withMessage('Username is required.'),
        body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').isMobilePhone().withMessage('Invalid phone number format'),
        body('first_name').notEmpty().trim().escape().withMessage('First name is required.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name is required.'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, phone_number } = req.body;

        // Check if the user already exists
        const queryCheck = 'SELECT * FROM login WHERE Email = ? OR User_name = ?';
        db.query(queryCheck, [email, username], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            if (results.length > 0) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // Insert the new user with the incremented ID
            const queryInsert = 'INSERT INTO login (User_Name, Email, Phone_number) VALUES (?, ?, ?)';
            db.query(queryInsert, [ username, email, phone_number], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Registration failed' });
                }
                console.log([result.insertId, username, email, phone_number], "Added to login");
                res.status(201).json({ message: 'Registration successful', userId: result.insertId });
        
                });
            
        });
    }
);
router.post(
    "/register/driver",
    [
        body('username').notEmpty().trim().escape().withMessage('Username is required and cannot be empty.'),
        body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').isMobilePhone().withMessage('Invalid phone number format'),
        body('first_name').notEmpty().trim().escape().withMessage('First name cannot be empty or only spaces.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name cannot be empty or only spaces.'),
        body('ID').notEmpty().isInt().withMessage('ID number of logged-in user has to be inputted'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const step = 'completed_driver';
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, phone_number, first_name, last_name, ID } = req.body;
        console.log(ID);

        // Check if email, username, or phone_number already exists in the database
        const queryCheck = `
            SELECT * 
            FROM login 
            WHERE (Email = ? OR User_name = ? OR Phone_Number = ?) AND ID = ?`;

        db.query(queryCheck, [email, username, phone_number, ID], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            // If any of the fields exist, return an error message
            if (results.length > 0) {
                return res.status(400).json({
                    message: 'A user with this email, username, or phone number already exists',
                });
            }

            try {
                // Step 1: Insert driver information
                const driverInsertQuery = `
                    INSERT INTO driver_information 
                    (ID, First_Name, Last_Name, User_Name, Email, Phone_Number, 
                     Service_Type, Gender, ID_Card, Passport, Valid_ID, Valid_Passport)
                    VALUES (?, ?, ?, ?, ?, ?, "NULL", "NULL", "NULL", "NULL", False, False)`;

                db.query(driverInsertQuery, [ID, first_name, last_name, username, email, phone_number], (err, driverResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error inserting driver information', error: err.sqlMessage });
                    }

                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID: ID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 4 weeks

                    // Define `updateTokenQuery` here before using it
                    const updateTokenQuery = `
                        UPDATE login 
                        SET token = ?, register_step = ?  
                        WHERE ID = ?`;

                    // Update the `token` column in the `login` table
                    db.query(updateTokenQuery, [sessionToken, step, ID], (err) => {
                        if (err) {
                            console.log('Database error while updating token for user ID');
                            return res.status(500).json({ message: 'Database error while updating token for user ID', error: err.sqlMessage });
                        }

                        console.log("Token has been updated for ID:", ID, "Token:", sessionToken);

                        // Respond with success
                        res.status(201).json({
                            message: 'Registration successful',
                            user: {
                                ID: ID,
                                username,
                                email,
                                sessionToken,
                            },
                        });
                    });
                });
            } catch (error) {
                console.error('Error in sign up:', error);
                res.status(500).send({ message: 'Server error' });
            }
        });
    }
);

router.post(
    "/register/bus_owner",
    [
        body('username').notEmpty().trim().escape().withMessage('Username is required and cannot be empty.'),
        body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').isMobilePhone().withMessage('Invalid phone number format'),
        body('first_name').notEmpty().trim().escape().withMessage('First name cannot be empty or only spaces.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name cannot be empty or only spaces.'),
        body('ID').notEmpty().isInt().withMessage('ID number of logged-in user has to be inputted'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const step = 'completed_bus_owner';
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, phone_number, first_name, last_name, ID } = req.body;
        console.log(ID);

        // Check if email, username, or phone_number already exists in the database
        const queryCheck = `
            SELECT * 
            FROM login 
            WHERE (Email = ? OR User_name = ? OR Phone_Number = ?) AND ID = ?`;

        db.query(queryCheck, [email, username, phone_number, ID], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            // If any of the fields exist, return an error message
            if (results.length > 0) {
                return res.status(400).json({
                    message: 'A user with this email, username, or phone number already exists',
                });
            }

            try {
                // Step 1: Insert bus owner information
                const busOwnerInsertQuery = `
                    INSERT INTO driver_information 
                    (ID, First_Name, Last_Name, User_Name, Email, Phone_Number, 
                     Company_ID, Gender, ID_Card, Passport, Valid_ID, Valid_Passport)
                    VALUES (?, ?, ?, ?, ?, ?, 0, "NULL", "NULL", "NULL", "NULL", False, False)`;

                db.query(busOwnerInsertQuery, [ID, first_name, last_name, username, email, phone_number], (err, busOwnerResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error inserting bus owner information', error: err.sqlMessage });
                    }

                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID: ID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 4 weeks

                    // Define `updateTokenQuery` here before using it
                    const updateTokenQuery = `
                        UPDATE login 
                        SET token = ?, register_step = ?  
                        WHERE ID = ?`;

                    // Update the `token` column in the `login` table
                    db.query(updateTokenQuery, [sessionToken, step, ID], (err) => {
                        if (err) {
                            console.log('Database error while updating token for user ID');
                            return res.status(500).json({ message: 'Database error while updating token for user ID', error: err.sqlMessage });
                        }

                        console.log("Token has been updated for ID:", ID, "Token:", sessionToken);

                        // Respond with success
                        res.status(201).json({
                            message: 'Registration successful',
                            user: {
                                ID: ID,
                                username,
                                email,
                                sessionToken,
                            },
                        });
                    });
                });
            } catch (error) {
                console.error('Error in sign up:', error);
                res.status(500).send({ message: 'Server error' });
            }
        });
    }
);




// POST Bus Information Registration API
router.post(
    "/register/bus", validateToken,
    [
        // Input validation and sanitization
        body("owner_id").isInt().withMessage("Owner ID must be an integer."),
        body("driver_id").isInt().withMessage("Driver ID must be an integer."),
        body("bus_number").isInt().withMessage("Bus Number must be an integer."),
        body("board_symbol").notEmpty().trim().escape().withMessage("Board Symbol cannot be empty."),
        body("driving_license_number").isInt().withMessage("Driving License Number must be an integer."),
        body("bus_specification").notEmpty().trim().escape().withMessage("Bus Specification cannot be empty."),
        body("air_conditioner").isBoolean().withMessage("Air Conditioner must be true or false."),
        body("image").notEmpty().trim().escape().withMessage("Image cannot be empty."),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // Destructure fields from request body
        const {
            owner_id,
            driver_id,
            bus_number,
            board_symbol,
            driving_license_number,
            bus_specification,
            air_conditioner,
            image,
        } = req.body;
        // Insert bus information into the database
        const query = `
            INSERT INTO Bus_Information (
                Owner_ID, Driver_ID, Bus_Number, Board_Symbol,
                Driving_License_number, Bus_Specification, Air_Conditioner, Image
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(
            query,
            [owner_id, driver_id, bus_number, board_symbol, driving_license_number, bus_specification, air_conditioner, image],
            (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ message: "Error registering bus information", error: err.sqlMessage });
                }
                // Respond with success and include bus info in response
                res.status(201).json({
                    message: "Bus registration successful",
                    bus: {
                        id: result.insertId,
                        owner_id,
                        driver_id,
                        bus_number,
                        board_symbol,
                        driving_license_number,
                        bus_specification,
                        air_conditioner,
                        image,
                    },
                });
            }
        );
    }
);
    
    
    
// POST /register/company route
router.post(
  "/register/company",
  validateToken,  
  [
    body("company_name").isString().notEmpty().withMessage("Company name must be a string."),
    body("contact_number").isInt().notEmpty().withMessage("Contact number must be an integer."),
    body("record_number").isInt().notEmpty().withMessage("Record number must be an integer."),
    body("commercial_register").notEmpty().isString().withMessage("Commercial register must be a string."),
    body("operating_permit").notEmpty().isString().withMessage("Operating permit must be a string."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { company_name, contact_number, record_number, commercial_register, operating_permit } = req.body;
    const owner_id = req.user.ID;  // Assuming `ID` is provided from the JWT token

    try {
      // Step 1: Check if the owner already has a company
      const ownerResult = await dbQuery(
        "SELECT Company_ID FROM owner_information WHERE ID = ?",
        [owner_id]
      );

      if (ownerResult.length > 0 && ownerResult[0].Company_ID !== 0) {
        return res.status(400).json({ message: "Owner already has a registered company." });
      }

      // Step 2: Insert the company data into the transportation_companies table
      const companyResult = await dbQuery(
        `INSERT INTO transportation_companies 
          (company_name, contact_number, record_number, owner_id, commercial_register, operating_permit)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [company_name, contact_number, record_number, owner_id, commercial_register, operating_permit]
      );

      const company_id = companyResult.insertId;  // The ID of the newly created company

      // Step 3: Update the owner_information table with the new company_id
      await dbQuery(
        "UPDATE owner_information SET Company_ID = ? WHERE ID = ?",
        [company_id, owner_id]
      );

      // Step 4: Return success response
      return res.status(200).json({
        message: "Company registered successfully.",
        company_id,
        company_name,
        owner_id,
      });

    } catch (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Internal server error", error: err.message });
    }
  }
);

// -------------------------------------------------------------------------------------------



// Helper function to wrap db queries into promises
const dbQuery = (query, values) => {
    return new Promise((resolve, reject) => {
      db.query(query, values, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

// POST /bus/add_driver route
router.post(
    "/bus/add_driver",
    validateToken,
    [
      body("bus_id").isInt().withMessage("Bus ID must be an integer."),
      body("driver_ids").isArray().withMessage("Driver IDs must be an array of integers."),
      body("driver_ids.*").isInt().withMessage("Each driver ID must be an integer."),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { bus_id, driver_ids } = req.body;
      const owner_id = req.user.ID;  // Get the owner ID from the JWT token
  
      try {
        // Step 1: Check if the bus is owned by the owner
        const busResult = await dbQuery(
          `SELECT Driver_ID, owner_id FROM bus_information WHERE ID = ?`,
          [bus_id]
        );
  
        if (busResult.length === 0) {
          return res.status(404).json({ message: "Bus not found." });
        }
  
        const bus = busResult[0];
  
  
        // Step 2: Parse Driver_ID from database and ensure it's an array
        let currentDrivers = [];
        try {
          currentDrivers = JSON.parse(bus.Driver_ID);
          if (!Array.isArray(currentDrivers)) {
            currentDrivers = [parseInt(currentDrivers)];
          }
        } catch (error) {
          currentDrivers = [parseInt(bus.Driver_ID)];
        }
  
        // Step 3: Remove duplicates from the list of driver IDs (if any)
        const uniqueDriverIds = [...new Set([...currentDrivers, ...driver_ids])];
  
        // Step 4: Validate each driver ID exists in the driver_information table
        const invalidDriverIds = [];
        for (const driverId of uniqueDriverIds) {
          const driverResult = await dbQuery(
            `SELECT ID FROM driver_information WHERE ID = ?`,
            [driverId]
          );
  
          if (driverResult.length === 0) {
            invalidDriverIds.push(driverId);
          }
        }
  
        // If there are any invalid driver IDs, return a 400 error
        if (invalidDriverIds.length > 0) {
          return res.status(400).json({ message: `Invalid driver IDs: ${invalidDriverIds.join(', ')}` });
        }
  
        // Step 5: Ensure the new driver list does not exceed the VARCHAR(255) limit
        const driverListString = JSON.stringify(uniqueDriverIds);
        if (driverListString.length > 255) {
          return res.status(400).json({ message: "The list of drivers exceeds the 255 character limit." });
        }
  
        // Step 6: Update the bus record with the new list of driver IDs
        await dbQuery(
          `UPDATE bus_information SET Driver_ID = ? WHERE ID = ?`,
          [driverListString, bus_id]
        );
  
        // Step 7: Return success response
        return res.status(200).json({
          message: "Drivers added successfully.",
          bus_id,
          updated_driver_ids: uniqueDriverIds,
        });
  
      } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
      }
    }
  );


// bus/remove_driver
router.post(
    "/bus/remove_driver",
    validateToken,
    [
      body("bus_id").isInt().withMessage("Bus ID must be an integer."),
      body("driver_ids").isArray().withMessage("Driver IDs must be an array of integers."),
      body("driver_ids.*").isInt().withMessage("Each driver ID must be an integer."),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { bus_id, driver_ids } = req.body;
      const owner_id = req.user.ID;  // Get the owner ID from the JWT token
  
      try {
        // Step 1: Check if the bus is owned by the owner
        const busResult = await dbQuery(
          `SELECT Driver_ID, owner_id FROM bus_information WHERE ID = ?`,
          [bus_id]
        );
  
        if (busResult.length === 0) {
          return res.status(404).json({ message: "Bus not found." });
        }
  
        const bus = busResult[0];
  
  
        // Step 2: Parse Driver_ID from the database and ensure it's an array
        let currentDrivers = [];
        try {
          currentDrivers = JSON.parse(bus.Driver_ID);
          if (!Array.isArray(currentDrivers)) {
            currentDrivers = [parseInt(currentDrivers)];
          }
        } catch (error) {
          currentDrivers = [parseInt(bus.Driver_ID)];
        }
  
        // Step 3: Validate each driver ID exists in the driver_information table
        const invalidDriverIds = [];
        const nonAssignedDriverIds = [];
  
        // Check if each driver ID exists and is currently assigned to the bus
        for (const driverId of driver_ids) {
          const driverResult = await dbQuery(
            `SELECT ID FROM driver_information WHERE ID = ?`,
            [driverId]
          );
  
          if (driverResult.length === 0) {
            invalidDriverIds.push(driverId);
          } else if (!currentDrivers.includes(driverId)) {
            nonAssignedDriverIds.push(driverId);
          }
        }
  
        // Step 4: If there are any invalid driver IDs, return a 400 error
        if (invalidDriverIds.length > 0) {
          return res.status(400).json({ message: `Invalid driver IDs: ${invalidDriverIds.join(', ')}` });
        }
  
        // If there are driver IDs that aren't assigned to the bus, return an error
        if (nonAssignedDriverIds.length > 0) {
          return res.status(400).json({ message: `Driver IDs not assigned to the bus: ${nonAssignedDriverIds.join(', ')}` });
        }
  
        // Step 5: Remove the driver IDs from the bus's current driver list
        const updatedDrivers = currentDrivers.filter(driverId => !driver_ids.includes(driverId));
  
        // Step 6: Ensure the new driver list does not exceed the VARCHAR(255) limit
        const driverListString = JSON.stringify(updatedDrivers);
        if (driverListString.length > 255) {
          return res.status(400).json({ message: "The list of drivers exceeds the 255 character limit." });
        }
  
        // Step 7: Update the bus record with the new list of driver IDs
        await dbQuery(
          `UPDATE bus_information SET Driver_ID = ? WHERE ID = ?`,
          [driverListString, bus_id]
        );
  
        // Step 8: Return success response
        return res.status(200).json({
          message: "Drivers removed successfully.",
          bus_id,
          updated_driver_ids: updatedDrivers,
        });
  
      } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
      }
    }
  );


// ----------------------------------------------------------------------------------------------------------------


// Route: Login API (Authenticate user and send OTP)
router.post(
    "/login",
    [
        body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').optional().isMobilePhone().withMessage('Invalid phone number'),
    ],
    async (req, res) => {
        var selection = "none";
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, phone_number } = req.body;

        if ((!email && !phone_number) || (email && phone_number)) {
            return res.status(400).json({ message: 'Please provide either email or phone number, but not both.' });
        }
        // Find user by email or phone number
        let query, params;
        if (email) {
            query = 'SELECT * FROM login WHERE email = ?';
            params = [email];
            selection = "email";
        } else {
            query = 'SELECT * FROM login WHERE phone_number = ?';
            params = [phone_number];
            selection = "phone";
        }

        db.query(query, params, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            if (result.length === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            const user = result[0];
            console.log(user);
            
            generateAndSaveOtp(user, selection, db, res);
            
            
            
        });
    }
);


const generateAndSaveOtp = (user, selection, db, res) => {
    // Replace with your 360dialog API key
    const API_KEY = 'APIKEY';
    
     //const otp = Math.floor(1000 + Math.random() * 9000);
    // Generate a 4-digit OTP and set expiration
    const otp = '1111'; // Replace with random OTP logic if needed
    const expiresAt = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

    // Delete any existing OTP entry for the user
    const deleteOtpQuery = `DELETE FROM otps WHERE User_ID = ?`;

    db.query(deleteOtpQuery, [user.ID], (err) => {
        if (err) {
            console.error(`Error deleting old OTP for user ${user.Email || user.Phone_Number}:`, err);
            return res.status(500).json({ message: 'Failed to delete old OTP' });
        }
        
        // Insert or update the OTP entry
        const otpQuery = `
            INSERT INTO otps (User_ID, expiresAt, otp)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                expiresAt = VALUES(expiresAt),
                otp = VALUES(otp)
        `;

        db.query(otpQuery, [user.ID, expiresAt, otp], (err) => {
            if (err) {
                console.error(`Error saving OTP for user ${user.Email || user.Phone_Number}:`, err);
                return res.status(500).json({ message: 'Error saving OTP', error: err.sqlMessage });
            }

            if (selection === 'phone') {
                const phoneNumber = '+968' + user.Phone_Number;

                // Send OTP via WhatsApp
                sendWhatsAppOtp(phoneNumber, otp, API_KEY)
                    .then((result) => {
                        console.log('Message sent successfully via WhatsApp:', result);


                            // Log OTP for testing (send via SMS/Email in production)
                    console.log(`Generated OTP: ${otp} for user: ${user.Phone_Number}`);

                    res.status(200).json({
                        message: `Login successful. OTP sent successfully via WhatsApp to phone: ${phoneNumber}`,
                        ID: user.ID


                    });

                    
                    
                    
                    })
                    .catch((error) => {
                        console.error('Failed to send message via WhatsApp:', error);
                        return res.status(500).json({
                            message: 'Failed to send OTP via WhatsApp',
                            error: error.message,
                        });
                    });
            } else if (selection === 'email') {
                // Send OTP via email
                sendBeautifulOTP(user.Email, otp)
                    .then(() => {
                        console.log(`OTP Email Sent To: ${user.Email}`);
                       
                    
                           // Log OTP for testing (send via SMS/Email in production)
                        console.log(`Generated OTP: ${otp} for user: ${user.Email}`);

                    
                        res.status(200).json({
                        message: `Login successful. OTP sent successfully to email: ${user.Email}`,
                        ID: user.ID


                    });

                    })
                    .catch((error) => {
                        console.error('Failed to send OTP email:', error);
                        return res.status(500).json({
                            message: 'Failed to send OTP email',
                            error: error.message,
                        });
                    });
            } else {
                console.error('Invalid selection for sending OTP.');
                return res.status(400).json({ message: 'Invalid selection for sending OTP.' });
            }
        });
    });
};
    
    
    

// LOGOUT API 


router.post('/logout', validateToken, (req, res) => {
    // Get the user's ID from the validated token (assuming validateToken sets req.user.ID)
    const userId = req.user.ID;

    // Delete the token from the `login` table
    const deleteTokenQuery = `UPDATE login SET token = NULL WHERE ID = ?`;
    db.query(deleteTokenQuery, [userId], (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error deleting token from database', error: err.sqlMessage });
        }

        res.status(200).json({
            message: 'Logged out successfully. Token has been removed from the database.',
        });
    });
});






// OTP Validation Route
router.post(
    "/validate-otp",
    [
        body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').optional().isMobilePhone().withMessage('Invalid phone number'),
        body('otp').isNumeric().withMessage('OTP must be numeric').notEmpty().withMessage('OTP is required').trim(),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, phone_number, otp } = req.body;

        // Step 1: Query the login table to retrieve the User_ID based on email or phone number
        let loginQuery, loginParams;
        if (email) {
            loginQuery = "SELECT ID, register_type FROM login WHERE Email = ?";
            loginParams = [email];
        } else {
            loginQuery = "SELECT ID, register_type FROM login WHERE Phone_Number = ?";
            loginParams = [phone_number];
        }

        db.query(loginQuery, loginParams, (err, results) => {
            if (err) {
                return res.status(500).json({ message: "Database error while retrieving user ID", error: err.sqlMessage });
            }

            if (results.length === 0) {
                return res.status(400).json({ message: "No user associated with this contact information" });
            }

            const user = results[0];

            // Step 2: Query the otps table using the retrieved User_ID to validate the OTP
            const otpQuery = "SELECT * FROM otps WHERE User_ID = ?";
            db.query(otpQuery, [user.ID], (err, otpResults) => {
                if (err) {
                    return res.status(500).json({ message: "Database error while retrieving OTP", error: err.sqlMessage });
                }

                if (otpResults.length === 0) {
                    return res.status(400).json({ message: "OTP not found or expired" });
                }

                const otpEntry = otpResults[0];

                // Check if the OTP is correct and not expired
                if (otpEntry.otp != otp) {
                    return res.status(400).json({ message: "Invalid OTP" });
                }
                if (Date.now() > otpEntry.expires_at) {
                    return res.status(400).json({ message: "OTP has expired" });
                }

                // OTP validation successful, delete the OTP from the database
                const deleteOtpQuery = "DELETE FROM otps WHERE User_ID = ?";
                db.query(deleteOtpQuery, [user.ID], (err) => {
                    if (err) {
                        return res.status(500).json({ message: "Error deleting OTP" });
                    }

                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID: user.ID }, SECRET_KEY, { expiresIn: "4w" });

                    // Store the sessionToken in the `token` column in the `login` table
                    const updateTokenQuery = "UPDATE login SET token = ? WHERE ID = ?";
                    db.query(updateTokenQuery, [sessionToken, user.ID], (err) => {
                        if (err) {
                            return res.status(500).json({ message: "Error updating token in database", error: err.sqlMessage });
                        }
                        console.log(user.register_type);
                        // Check the `register_type` and fetch corresponding information
                        if (user.register_type === "captain") {
                            getDriverInformation(user.ID, (err, driverInfo) => {
                                if (err) {
                                    return res.status(500).json({ message: "Error retrieving driver information", error: err.sqlMessage });
                                }
                                return res.status(200).json({
                                    message: "OTP validated successfully.",
                                    user: {
                                        ...user,
                                        Valid_ID: driverInfo.Valid_ID,
                                        Valid_Passport: driverInfo.Valid_Passport,
                                    },
                                    sessionToken,
                                });
                            });
                        } else if (user.register_type === "bus_owner" || user.register_type === "both") {
                            getOwnerInformation(user.ID, (err, ownerInfo) => {
                                if (err) {
                                    return res.status(500).json({ message: "Error retrieving owner information", error: err.sqlMessage });
                                }
                                return res.status(200).json({
                                    message: "OTP validated successfully. 11",
                                    user: {
                                        ...user,
                                        Valid_ID: ownerInfo.Valid_ID,
                                        Valid_Passport: ownerInfo.Valid_Passport,
                                    },
                                    sessionToken,
                                });
                            });
                        } else {
                            return res.status(200).json({
                                message: "OTP validated successfully. 22",
                                user: {
                                    ...user,
                                    Valid_ID: "not_uploaded",
                                    Valid_Passport: "not_uploaded",
                                },
                                sessionToken,
                            });
                        }
                    });
                });
            });
        });
    }
);




function getDriverInformation(userId, callback) {
    const query = "SELECT Valid_ID, Valid_Passport FROM driver_information WHERE ID = ?";
    db.query(query, [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        console.log(results);
        if (results.length === 0) {
            return callback(null, { Valid_ID: "not_uploaded", Valid_Passport: "not_uploaded" });
        }
        const result = results[0];
        callback(null, {
            Valid_ID: result.Valid_ID === 1 ? "uploaded" : "not_uploaded",
            Valid_Passport: result.Valid_Passport === 1 ? "uploaded" : "not_uploaded",
        });
    });
}

function getOwnerInformation(userId, callback) {
    const query = "SELECT Valid_ID, Valid_Passport FROM owner_information WHERE ID = ?";
    db.query(query, [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        console.log(results);
        if (results.length === 0) {
            return callback(null, { Valid_ID: "not_uploaded", Valid_Passport: "not_uploaded" });
        }
        const result = results[0];
        callback(null, {
            Valid_ID: result.Valid_ID === 1 ? "uploaded" : "not_uploaded",
            Valid_Passport: result.Valid_Passport === 1 ? "uploaded" : "not_uploaded",
        });
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
    
    
    
    
    
// Setting system role for users by super_admins
router.post(
  '/user/set_role',
  validateToken,       // Step 1: JWT validation middleware
  requireRole('super_admin'),
  [
    // Step 3: Validation for input fields
    body('target_id')
      .isInt().withMessage('Target user ID must be an integer.'),
    body('role')
      .isIn(['super_admin', 'admin', 'user'])
      .withMessage('new_role must be one of these options: super_admin, admin, user')
  ],
  async (req, res) => {
    // Step 4: If validation fails, return a 400 error with detailed messages
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors: errors.array().map(err => err.msg) 
      });
    }

    // Step 5: Destructure the target user ID and the new role from the request body
    const { target_id, role: new_role } = req.body;

    try {
      // Step 6: Check if the target user exists in the database
      const targetUser = await dbQuery(
        `SELECT ID FROM login WHERE ID = ?`,
        [target_id]
      );

      // If the user is not found, return a 404 error
      if (targetUser.length === 0) {
        return res.status(404).json({ message: "Target user not found." });
      }

      // Step 7: Update the role of the target user in the database
      await dbQuery(`UPDATE login SET system_role = ? WHERE ID = ?`, [new_role, target_id]);
    
      console.log("Role updated successfully.",
        target_id,
        new_role);
        
      // Step 8: Return a success response
      return res.status(200).json({
        message: "Role updated successfully.",
        target_id,
        new_role
      });

    } catch (err) {
      // Step 9: Catch any database errors and return a 500 response
      console.error("Database error:", err);
      return res.status(500).json({ 
        message: "Internal server error during role update", 
        error: err.message 
      });
    }
  }
);


    
    
    
//******************************************************************************************************************

// Update register_type API
router.post(
    '/register-type',
    validateToken,
    [
        body('register_type').notEmpty().escape().withMessage('Invalid input. Please provide register_type.')
    ],
    (req, res) => {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { register_type } = req.body; // Correct key to match request body
        const userId = req.user.ID;

        console.log('Register Type:', register_type);

        // Check if register_type is valid
        const validRegisterTypes = ['captain', 'both', 'bus_owner'];
        if (!validRegisterTypes.includes(register_type)) {
            return res.status(400).json({
                message: `Invalid register_type. Allowed values are: ${validRegisterTypes.join(', ')}`,
            });
        }

        // Update query
        const updateQuery = `UPDATE login SET register_type = ? WHERE ID = ?`;

        db.query(updateQuery, [register_type, userId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Error updating register_type in database.',
                    error: err.sqlMessage,
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found. Unable to update register_type.',
                });
            }

            res.status(200).json({
                message: 'register_type updated successfully.',
                updated: {
                    userId,
                    register_type,
                },
            });
        });
    }
);



// get profile
router.get('/profile', validateToken, (req, res) => {
    // Get the user's ID from the validated token (assuming validateToken sets req.user.ID)
    const userId = req.user.ID;
        
    // Get the current timestamp in milliseconds 
    const time = Date.now(); // This is the current time in milliseconds
    // Convert it to the 'YYYY-MM-DD' format
    const today = new Date(time).toISOString().split('T')[0];  // 'YYYY-MM-DD'


    // Check the register type
    db.query('SELECT register_type FROM login WHERE ID = ?', [userId], (err, typeResult) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching register type from database', error: err.sqlMessage });
        }

        const registerType = typeResult[0]?.register_type;

        if (registerType === 'captain') {
    // Fetch user details for the given userId
    const getUserInfo = `SELECT ID, First_Name, Last_Name, User_Name, Email, Phone_Number, Service_Type, Gender FROM driver_information WHERE ID = ?`;

    db.query(getUserInfo, [userId], (err, userInfoResult) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching user information from database', error: err.sqlMessage });
        }

        const userInfo = userInfoResult[0];

        if (!userInfo) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Search for buses the captain drives
        const getDrivenBuses = `
            SELECT DISTINCT bi.*, 
       oi.First_Name AS Owner_First_Name, 
       oi.Last_Name AS Owner_Last_Name,
       oi.Phone_Number AS Owner_Contact
        FROM bus_information bi
        INNER JOIN owner_information oi ON bi.owner_id = oi.ID
        WHERE JSON_CONTAINS(bi.Driver_ID, CAST(? AS JSON))

        `;

        db.query(getDrivenBuses, [userId], (err, drivenBuses) => {
    if (err) {
        return res.status(500).json({ message: 'Error fetching driven buses from database', error: err.sqlMessage });
    }

    // If no buses are found
    if (!drivenBuses.length) {
        return res.status(200).json({
            Profile_Info: {
                User_Info: userInfo,
                User_Type: 'Captain',
                Buses_Driven: 'No buses found.',
            },
        });
    }

    // For each bus, get all captains who drive that bus
    const getAllCaptainsForBuses = `
        SELECT DISTINCT di.ID AS Captain_ID, di.First_Name, di.Last_Name, di.Email, di.Phone_Number, di.Service_Type, di.Gender
        FROM bus_information bi
        INNER JOIN driver_information di ON JSON_CONTAINS(bi.Driver_ID, JSON_ARRAY(di.ID))
        WHERE bi.ID = ?
    `;

    const busPromises = drivenBuses.map(bus =>
        new Promise((resolve, reject) => {
            db.query(getAllCaptainsForBuses, [bus.ID], (err, captains) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    Bus_ID: bus.ID,
                    Bus_Number: bus.Bus_Number,
                    Board_Symbol: bus.Board_Symbol,
                    Driving_License_Number: bus.Driving_License_number,
                    Capacity: bus.capacity,
                    Passengers: bus.passangers,
                    Bus_Specification: bus.Bus_Specification,
                    Air_Conditioner: Boolean(bus.Air_Conditioner),
                    Image: bus.Image,
                    Owner_Info: {
                        First_Name: bus.Owner_First_Name,
                        Last_Name: bus.Owner_Last_Name,
                        Contact: bus.Owner_Contact
                    },
                    Captains: captains
                });
            });
        })
    );

    // Wait for all bus queries to complete
    Promise.all(busPromises)
        .then(busDetailsWithCaptains => {
            res.status(200).json({
                Profile_Info: {
                    User_Info: {
                        ID: userInfo.ID,
                        First_Name: userInfo.First_Name,
                        Last_Name: userInfo.Last_Name,
                        User_Name: userInfo.User_Name,
                        Email: userInfo.Email,
                        Phone_Number: userInfo.Phone_Number,
                        Service_Type: userInfo.Service_Type,
                        Gender: userInfo.Gender
                    },
                    User_Type: 'Captain',
                    Buses_Driven: busDetailsWithCaptains
                }
            });
        })
        .catch(error => {
            res.status(500).json({ message: 'Error fetching captains for buses', error: error.message });
        });



        });
    });
}



            else if (registerType === 'both' || registerType === 'bus_owner') {
            // Search for buses the owner owns and get data of the drivers
            const getOwnedBuses = `
                SELECT bi.*, di.First_Name, di.Last_Name, di.User_Name, di.Email, di.Phone_Number, di.Service_Type, di.Gender
                FROM bus_information bi
                LEFT JOIN driver_information di ON JSON_CONTAINS(bi.Driver_ID, JSON_ARRAY(di.ID))
                WHERE bi.owner_id = ?
            `;

            db.query(getOwnedBuses, [userId], (err, ownedBuses) => {
                if (err) {
                    return res.status(500).json({ message: 'Error fetching owned buses from database', error: err.sqlMessage });
                }

                // Fetch owner data
                const getOwnerInformation = `SELECT * FROM owner_information WHERE ID = ?`;

                db.query(getOwnerInformation, [userId], (err, ownerInfo) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error fetching owner information', error: err.sqlMessage });
                    }        
                
                    
                    
             // Second query: Get total captains (drivers) who work for this owner
            const totalCaptains = `
            SELECT DISTINCT di.ID, di.First_Name, di.Last_Name, di.User_Name, di.Email, di.Phone_Number, di.Service_Type, di.Gender
            FROM bus_information bi
            INNER JOIN driver_information di
            ON JSON_CONTAINS(bi.Driver_ID, JSON_ARRAY(di.ID))
            WHERE bi.owner_id = ?
            `;    
                    
            
                
                    
             db.query(totalCaptains, [userId, userId], (err, captains) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching captains from database', error: err.sqlMessage });
            }

            // Query to get today's trip count for the owner's buses
            const countTripsToday = `
                SELECT COUNT(*) AS trip_count
                FROM trip_details td
                INNER JOIN bus_information bi ON td.Bus_ID = bi.ID
                WHERE bi.owner_id = ? AND td.Trip_Date = ?`;

            db.query(countTripsToday, [userId, today], (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Error fetching trip count from database', error: err.sqlMessage });
                }

                const travelsPerDay = result[0] ? result[0].trip_count : 0;

                // Construct the response
                res.status(200).json({
                    Profile_Info: {
                        Owner_Data: ownerInfo.length > 0 ? ownerInfo[0] : 'No owner data found.',
                        
                        Rating: 5, // Rating out of five
                        Profile_Picture: "profile.jpg",
                    },
                    Total_Statistics: {
                        Travels_Per_Day: travelsPerDay, // Use the actual count for today
                        Total_Buses: ownedBuses.length,
                        Total_Captains: captains.length,
                    },
                    User_Type: registerType === 'both' ? 'Both (Owner and Captain)' : 'Bus Owner',
                    Buses_Owned: ownedBuses.length > 0 ? ownedBuses : 'No buses found.', // Return the list or a message if empty
                    My_Captains: captains.length > 0 ? captains : "No Captains."  // Return the list or a message if empty
                });
            });
        });
                    
                    
                    
                    
                });
            });
        } else {
            res.status(400).json({ message: 'Invalid register type.' });
        }
    });
});




// register invitation 
router.post(
    "/register/invitation",
    validateToken,
    [
      body("bus_id").isInt().withMessage("Bus ID must be an integer."),
      body("invitee_id").isInt().withMessage("Invitee ID must be an integer."),
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { bus_id, invitee_id } = req.body;
      const owner_id = req.user.ID;
  
      // Step 1: Check if the bus is owned by the owner
      const checkBusQuery = `
        SELECT Driver_ID, owner_id 
        FROM bus_information 
        WHERE ID = ? 
      `;
      db.query(checkBusQuery, [bus_id], (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Error checking bus ownership", error: err.sqlMessage });
        }
  
        if (result.length === 0) {
          return res.status(404).json({ message: "Bus not found." });
        }
  
        const bus = result[0];
  
        // Check if the bus is owned by the current owner
        if (bus.owner_id !== owner_id) {
          return res.status(403).json({ message: "You are not the owner of this bus." });
        }
  
        // Step 2: Parse Driver_ID and ensure it's an array
        let assignedDrivers = [];
        try {
          assignedDrivers = JSON.parse(bus.Driver_ID);
          if (!Array.isArray(assignedDrivers)) {
            assignedDrivers = [parseInt(assignedDrivers)];
          }
        } catch (error) {
          assignedDrivers = [parseInt(bus.Driver_ID)];
        }
  
        // Now check if the invitee_id is included in assignedDrivers
        if (assignedDrivers.includes(invitee_id)) {
          return res.status(400).json({ message: "This captain is already assigned to the bus." });
        }
  
        // Step 3: Check if the invitee (captain) exists in the login table and has 'captain' as register_type
        const checkCaptainQuery = `
          SELECT 1 FROM login 
          WHERE ID = ? AND register_type = 'captain'
        `;
        db.query(checkCaptainQuery, [invitee_id], (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Error checking captain validity", error: err.sqlMessage });
          }
  
          if (result.length === 0) {
            return res.status(404).json({ message: "Invitee is not a valid captain." });
          }
  
          // Step 4: Check if an invitation already exists with the same bus_id, owner_id, and invitee_id
          const checkExistingInvitationQuery = `
            SELECT 1 FROM pending_invitation
            WHERE bus_id = ? AND owner_id = ? AND invitee_id = ? AND invite_status = 'pending'
          `;
          db.query(checkExistingInvitationQuery, [bus_id, owner_id, invitee_id], (err, result) => {
            if (err) {
              console.error("Database error:", err);
              return res.status(500).json({ message: "Error checking for existing invitation", error: err.sqlMessage });
            }
  
            if (result.length > 0) {
              return res.status(400).json({ message: "An invitation for this captain is already pending for this bus." });
            }
  
            // Step 5: Insert pending invitation into the database
            const insertQuery = `
              INSERT INTO pending_invitation (owner_id, bus_id, invitee_id, invite_status)
              VALUES (?, ?, ?, 'pending')
            `;
            db.query(
              insertQuery, 
              [owner_id, bus_id, invitee_id],
              (err, result) => {
                if (err) {
                  console.error("Database error:", err);
                  return res.status(500).json({ message: "Error registering invitation", error: err.sqlMessage });
                }
  
                // Respond with success
                res.status(201).json({
                  message: "Invitation sent successfully",
                  invitation: {
                    invitation_id: result.insertId,
                    owner_id,
                    bus_id,
                    invitee_id,
                    invite_status: 'pending',
                  },
                });
              }
            );
          });
        });
      });
    }
  );

  // Get all pending invitations to me
  router.get("/invitations/pending", validateToken, (req, res) => {
    const captain_id = req.user.ID; // Assuming `validateToken` middleware adds the user data to `req.user`

    // Step 1: Fetch all pending invitations for the captain
    const getPendingInvitationsQuery = `
        SELECT pi.id AS invitation_id, pi.owner_id, pi.bus_id, pi.invitee_id, pi.invite_status, 
               bi.Bus_Number, bi.Board_Symbol, bi.Bus_Specification, bi.capacity
        FROM pending_invitation pi
        JOIN bus_information bi ON pi.bus_id = bi.ID
        WHERE pi.invitee_id = ? AND pi.invite_status = 'pending'
    `;

    db.query(getPendingInvitationsQuery, [captain_id], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Error fetching invitations", error: err.sqlMessage });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "No pending invitations found." });
        }

        // Step 2: Return the invitations
        res.status(200).json({
            message: "Pending invitations retrieved successfully",
            invitations: results,
        });
    });
});

// Reply to a pending invitation with acceptance or rejection.
router.post("/invitation/reply", validateToken, [
    // Input validation and sanitization
    body("invitation_id").isInt().withMessage("Invitation ID must be an integer."),
    body("reply").isIn(["accepted", "rejected"]).withMessage("Reply must be either 'accepted' or 'rejected'."),
  ], (req, res) => {
    const { invitation_id, reply } = req.body;
    const captain_id = req.user.ID; // Assuming the `validateToken` middleware adds the user data to `req.user`
  
    // If the reply is not valid (not 'accepted' or 'rejected'), return an error
    if (!['accepted', 'rejected'].includes(reply)) {
      return res.status(400).json({ message: "Invalid reply. It must be either 'accepted' or 'rejected'." });
    }
  
    // Step 1: Validate the invitation and check if it is still pending
    const checkInvitationQuery = `
      SELECT id, invite_status, invitee_id 
      FROM pending_invitation 
      WHERE id = ? AND invite_status = 'pending' AND invitee_id = ?
    `;
    
    db.query(checkInvitationQuery, [invitation_id, captain_id], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error checking invitation status", error: err.sqlMessage });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ message: "Invitation not found or it is no longer pending." });
      }
  
      // Step 2: Update the invitation status to 'accepted' or 'rejected'
      const updateInvitationQuery = `
        UPDATE pending_invitation
        SET invite_status = ?
        WHERE id = ?
      `;
      
      db.query(updateInvitationQuery, [reply, invitation_id], (err, updateResult) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Error updating invitation status", error: err.sqlMessage });
        }
  
        // Step 3: Respond with a success message
        res.status(200).json({
          message: `Invitation ${reply} successfully.`,
          invitation_id,
          reply,
        });
      });
    });
  });
  
  




module.exports = router;
