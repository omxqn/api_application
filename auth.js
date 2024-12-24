const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const validateToken = require('./validateToken'); // Import the validation middleware
const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;


// User Registration API
router.post(
    "/register/user",
    [
        body('username').notEmpty().trim().escape().withMessage('Username is required.'),
        body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').isMobilePhone().withMessage('Invalid phone number format'),
        body('first_name').notEmpty().trim().escape().withMessage('First name is required.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name is required.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, email, phone_number, first_name, last_name } = req.body;

        const queryCheck = 'SELECT * FROM login WHERE Email = ? OR User_name = ?';
        db.query(queryCheck, [email, username], (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (results.length > 0) return res.status(400).json({ message: 'User already exists' });

            const queryInsert = 'INSERT INTO login (User_Name, Email, Phone_number) VALUES (?, ?, ?)';
            db.query(queryInsert, [username, email, phone_number], (err, result) => {
                if (err) return res.status(500).json({ message: 'Registration failed' });
                res.status(201).json({ message: 'Registration successful', userId: result.insertId });
            });
        });
    }
);





// POST Registration API (Sign-Up)
router.post(
    "/register/driver",
    [
        // Input validation and sanitization
        body('username').notEmpty().trim().escape().withMessage('Username is required and cannot be empty.'),
        body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').isMobilePhone().withMessage('Invalid phone number format'),
        body('first_name').notEmpty().trim().escape().withMessage('First name cannot be empty or only spaces.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name cannot be empty or only spaces.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, phone_number, first_name, last_name } = req.body;

        // Check if user already exists (by email or username) in the database
        const queryCheck = 'SELECT * FROM login WHERE Email = ? OR User_name = ?';

        db.query(queryCheck, [email, username], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length > 0) {
                return res.status(400).json({ message: 'User with this email or username already exists' });
            }

            // Move the try block here
            try {
                // Step 1: Insert driver information first (if necessary)
                const driverInsertQuery =  `INSERT INTO driver_information (First_Name, Last_Name, User_Name, Email, Phone_Number, 
                        Service_Type, Gender, ID_Card, Passport, Valid_ID, Valid_Passport)
                    VALUES (?, ?, ?, ?, ?, "test", "test", "test", "test", False, False)`
                ;
                
                db.query(driverInsertQuery, [first_name, last_name, username, email, phone_number], (err, driverResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error inserting driver information', error: err.sqlMessage  });
                    }
                    
                    const driverId = driverResult.insertId; // Get the ID of the newly inserted driver

                    // Insert the new user into the database
                    const queryInsert = 
                        `INSERT INTO login (ID, User_Name, Email, Phone_number)
                        VALUES (?, ?, ?, ?)`;

                    db.query(
                        queryInsert,
                        [driverId, username, email, phone_number],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ message: 'Database error during registration', error: err.sqlMessage });
                            }
                                
                            db.query('SELECT ID FROM login WHERE Email = ?', [email], (err, results) => {
                            if (err) {
                                return res.status(500).json({ message: 'Database error while retrieving user ID' , error: err ? err.sqlMessage : 'Unknown error'});
                            }

                            if (results.length === 0) {
                                return res.status(400).json({ message: 'No user associated with this contact information'});
                            }

                            const userID = results[0].ID;
                            // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID:userID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 1 hour
                    // Store the sessionToken in the `token` column in the `login` table
                    const updateTokenQuery = `UPDATE login SET token = ? WHERE ID = ?`;
                    db.query(updateTokenQuery, [sessionToken, userID], (err) => {
                        if (err) {
                            return res.status(500).json({ message: 'Error updating token in database', error: err.sqlMessage });
                        }

                        // Respond with success
                            res.status(201).json({
                                message: 'Registration successful',
                                user: {
                                    ID: userID,  // MySQL will return the inserted ID
                                    username,
                                    email,
                                    sessionToken,
                                    
                                },});
                        });
                                
                            
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
router
    .post(
    "/register/bus",validateToken,
    [
        // Input validation and sanitization
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
                Driver_ID, Bus_Number, Board_Symbol, Driving_License_number,
                Bus_Specification, Air_Conditioner, Image
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            query,
            [driver_id, bus_number, board_symbol, driving_license_number, bus_specification, air_conditioner, image],
            (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ message: "Error registering bus information", error: err.sqlMessage });
                }
                generateAndSaveOtp(user, db, res);

                // Respond with success and include bus info in response
                res.status(201).json({
                    message: "Bus registration successful",
                    bus: {
                        id: result.insertId,
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


const generateAndSaveOtp = (user, db, res) => {
    // Generate a 4-digit OTP and set expiration
    const otp = Math.floor(1000 + Math.random() * 9000);
    const expiresAt = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

    // Delete any existing OTP entry for the user
    const deleteOtpQuery = `DELETE FROM otps WHERE User_ID = ?`;

    db.query(deleteOtpQuery, [user.ID], (err) => {
        if (err) {
            return res.status(500).json({ message: `Duplicate OTP has been found for ${user.email}` });
        }

        // Insert or update the OTP entry
        const otpQuery = `
            INSERT INTO otps (User_ID, expiresAt, otp)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                User_ID = VALUES(User_ID),
                expiresAt = VALUES(expiresAt),
                otp = VALUES(otp)
        `;

        // Execute the query to save the OTP
        db.query(otpQuery, [user.ID, expiresAt, otp], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error saving OTP', error: err.sqlMessage });
            }

            // Log OTP for testing (send via SMS/Email in production)
            console.log(`Generated OTP: ${otp} for user: ${user.Email || user.Phone_number}`);

            res.status(200).json({
                message: 'Login successful. OTP has been sent to your email or phone.',
                ID: user.ID
            });
        });
    });
};





// -------------------------------------------------------------------------------------------




// Route: Login API (Authenticate user and send OTP)
router.post(
    "/login",
    [
        body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').optional().isMobilePhone().withMessage('Invalid phone number'),
    ],
    (req, res) => {
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
        } else {
            query = 'SELECT * FROM login WHERE phone_number = ?';
            params = [phone_number];
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
            generateAndSaveOtp(user, db, res);
            
        });
    }
);








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








// passport upload mechanisem
// ID upload mechanisem



// Route: OTP Validation API (Validate OTP)
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
            loginQuery = 'SELECT ID FROM login WHERE Email = ?';
            loginParams = [email];
        } else {
            loginQuery = 'SELECT ID FROM login WHERE Phone_Number = ?';
            loginParams = [phone_number];
        }

        db.query(loginQuery, loginParams, (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error while retrieving user ID' , error: err ? err.sqlMessage : 'Unknown error'});
            }

            if (results.length === 0) {
                return res.status(400).json({ message: 'No user associated with this contact information'});
            }
            

            const userID = results[0].ID;

            // Step 2: Query the otps table using the retrieved User_ID to validate the OTP
            console.log(userID);
            const otpQuery = 'SELECT * FROM otps WHERE User_ID = ?';
            db.query(otpQuery, [userID], (err, otpResults) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error while retrieving OTP' , error: err ? err.sqlMessage : 'Unknown error'});
                }

                if (otpResults.length === 0) {
                    return res.status(400).json({ message: 'OTP not found or expired' });
                }

                const otpEntry = otpResults[0];

                // Check if the OTP is correct and not expired
                if (otpEntry.otp != otp) {
                    return res.status(400).json({ message: 'Invalid OTP' });
                }
                if (Date.now() > otpEntry.expires_at) {
                    return res.status(400).json({ message: 'OTP has expired' });
                }

                // OTP validation successful, delete the OTP from the database
                const deleteOtpQuery = 'DELETE FROM otps WHERE User_ID = ?';
                db.query(deleteOtpQuery, [userID], (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error deleting OTP' });
                    }
                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID:userID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 1 hour
                    // Store the sessionToken in the `token` column in the `login` table
                    console.log(userID,sessionToken);
                    const updateTokenQuery = `UPDATE login SET token = ? WHERE ID = ?`;
                    db.query(updateTokenQuery, [sessionToken, userID], (err) => {
                        if (err) {
                            console.error('Error updating token in database:', err);
                            return res.status(500).json({ message: 'Error updating token in database', error: err.sqlMessage });
                            
                        }

                        res.status(200).json({
                        message: 'OTP validated successfully. You are now logged in.',
                        sessionToken, // Return the token as a session ID
                        ID: userID,});
                    });

                    
                });
            });
        });
    }
);


module.exports = router;
