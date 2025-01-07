const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const validateToken = require('./validateToken'); // Import the validation middleware
const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

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
        body('ID').notEmpty().isInt().withMessage('ID number of logged in user has to be inputed'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, phone_number, first_name, last_name, ID } = req.body;
        console.log(ID);

        // Check if user already exists (by email or username) in the database
        const queryCheck = 'SELECT * FROM login WHERE (Email = ? OR User_name = ?) AND ID = ?';
        db.query(queryCheck, [email, username, ID], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            console.log(results);
            if (results.length <= 0) {
                return res.status(400).json({ message: 'User with this email or username doesn\'t exist in login' });
            }

            try {
                // Step 1: Insert driver information
                const driverInsertQuery = `INSERT INTO driver_information (ID, First_Name, Last_Name, User_Name, Email, Phone_Number, 
                        Service_Type, Gender, ID_Card, Passport, Valid_ID, Valid_Passport)
                    VALUES (?, ?, ?, ?, ?, ?, "NULL", "NULL", "NULL", "NULL", False, False)`;

                db.query(driverInsertQuery, [ID, first_name, last_name, username, email, phone_number], (err, driverResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error inserting driver information', error: err.sqlMessage });
                    }

                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID: ID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 4 weeks

                    // Define `updateTokenQuery` here before using it
                    const updateTokenQuery = `UPDATE login SET token = ? WHERE ID = ?`;

                    // Update the `token` column in the `login` table
                    db.query(updateTokenQuery, [sessionToken, ID], (err) => {
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

// get profile
router.get('/profile', validateToken, (req, res) => {
    // Get the user's ID from the validated token (assuming validateToken sets req.user.ID)
    const userId = req.user.ID;

    // Get the current timestamp in milliseconds 
    const time = Date.now(); // This is the current time in milliseconds
    // Convert it to the 'YYYY-MM-DD' format
    const today = new Date(time).toISOString().split('T')[0];  // 'YYYY-MM-DD'

    // First query: Get buses for the owner
    const getBuses = `SELECT * FROM bus_information WHERE owner_id = ?`;
    db.query(getBuses, [userId], (err, buses) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching buses from database', error: err.sqlMessage });
        }

        // Second query: Get total captains (drivers) who work for this owner
        const totalCaptains = `SELECT DISTINCT di.ID, di.First_Name, di.Last_Name, di.User_Name, di.Email, di.Phone_Number, di.Service_Type, di.Gender
        FROM trip_details td
        INNER JOIN bus_information bi ON td.Bus_ID = bi.ID
        INNER JOIN driver_information di ON td.Driver_ID = di.ID
        WHERE bi.owner_id = ?
          AND td.Driver_ID != ?`;

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
                        Owner_Name: "my name", 
                        Rating: 5, // Rating out of five
                        Profile_Picture: "profile.jpg",
                    },
                    Total_Statistics: {
                        Travels_Per_Day: travelsPerDay, // Use the actual count for today
                        Total_Buses: buses.length,
                        Total_Captains: captains.length,
                    },
                    Owend_Buses: buses.length > 0 ? buses : "No owned buses.", // Return the list or a message if empty
                    My_Captains: captains.length > 0 ? captains : "No Captains."  // Return the list or a message if empty
                });
            });
        });
    });
}); 


module.exports = router;
