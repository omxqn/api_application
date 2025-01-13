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
        const step = 'completed_driver';
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
                    const updateTokenQuery = `UPDATE login SET token = ?, register_step = ?  WHERE ID = ?`;

                    // Update the `token` column in the `login` table
                    db.query(updateTokenQuery, [sessionToken,step, ID], (err) => {
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
        //body('company_id').notEmpty().isInt().withMessage('ID of company has to be inputed'),
        body('first_name').notEmpty().trim().escape().withMessage('First name cannot be empty or only spaces.'),
        body('last_name').notEmpty().trim().escape().withMessage('Last name cannot be empty or only spaces.'),
        body('ID').notEmpty().isInt().withMessage('ID number of logged in user has to be inputed'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const step = 'completed_bus_owner';
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
                        Company_ID, Gender, ID_Card, Passport, Valid_ID, Valid_Passport)
                    VALUES (?, ?, ?, ?, ?, ?, 0, "NULL", "NULL", "NULL", "NULL", False, False)`;

                db.query(driverInsertQuery, [ID, first_name, last_name, username, email, phone_number], (err, driverResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error inserting driver information', error: err.sqlMessage });
                    }

                    // Generate a JWT token to use as a session ID
                    const sessionToken = jwt.sign({ ID: ID }, SECRET_KEY, { expiresIn: '4w' }); // Token expires in 4 weeks

                    // Define `updateTokenQuery` here before using it
                    const updateTokenQuery = `UPDATE login SET token = ?, register_step = ?  WHERE ID = ?`;

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
