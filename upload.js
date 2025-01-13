const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('./database'); // Assuming you have a database module
const validateToken = require('./validateToken');

const router = express.Router();

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
ensureDirectoryExists('uploads/passports');
ensureDirectoryExists('uploads/idcards');

// Configure multer storage for passport uploads
const passportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/passports');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const passportUpload = multer({ storage: passportStorage });

// Configure multer storage for ID card uploads
const idCardStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/idcards');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const idCardUpload = multer({ storage: idCardStorage });

// Error handling middleware for multer
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Determine the expected field name for the endpoint
        const expectedField = req.originalUrl.includes('passport') ? 'passport' : 'idcard';

        // Handle multer-specific errors
        return res.status(400).json({
            message: `MulterError: ${err.message}`,
            detail: `Expected the form-data field name to be '${expectedField}'`,
        });
    }
    next(err); // Pass the error to the next middleware if it's not a MulterError
};

// Passport Upload Endpoint
router.post(
    '/upload/passport',
    validateToken,
    passportUpload.single('passport'),
    (req, res, next) => {
        console.log("Request Body:", req.body);
        console.log("File received:", req.file);

        if (!req.file) {
            return res.status(400).json({
                message: 'No passport file uploaded',
                detail: "Expected form-data field name: passport",
            });
        }

        const userId = req.user.ID; // User ID from token

        // Step 1: Get `register_type` for the user
        const registerTypeQuery = 'SELECT register_type FROM login WHERE ID = ?';
        db.query(registerTypeQuery, [userId], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching user register_type', error: err.sqlMessage });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const registerType = results[0].register_type;
            const passportPath = req.file.path;

            // Step 2: Update the appropriate table and set Valid_ID and Valid_Passport
            let updateQuery;
            if (registerType === 'captain') {
                updateQuery = `
                    UPDATE driver_information 
                    SET Passport = ?, Valid_Passport = '1' 
                    WHERE ID = ?
                `;
            } else if (registerType === 'bus_owner' || registerType === 'both') {
                updateQuery = `
                    UPDATE owner_information 
                    SET Passport = ?, Valid_Passport = '1' 
                    WHERE ID = ?
                `;
            } else {
                return res.status(400).json({ message: 'Invalid register_type for user' });
            }

            db.query(updateQuery, [passportPath, userId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error updating passport in database', error: err.sqlMessage });
                }

                res.status(200).json({
                    message: 'Passport uploaded and validation updated successfully',
                    filePath: passportPath,
                });
            });
        });
    },
    multerErrorHandler // Attach multer error handler
);

// ID Card Upload Endpoint
router.post(
    '/upload/idcard',
    validateToken,
    idCardUpload.single('idcard'),
    (req, res, next) => {
        console.log("Request Body:", req.body);
        console.log("File received:", req.file);

        if (!req.file) {
            return res.status(400).json({
                message: 'No ID card file uploaded',
                detail: "Expected form-data field name: idcard",
            });
        }

        const userId = req.user.ID; // User ID from token

        // Step 1: Get `register_type` for the user
        const registerTypeQuery = 'SELECT register_type FROM login WHERE ID = ?';
        db.query(registerTypeQuery, [userId], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching user register_type', error: err.sqlMessage });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const registerType = results[0].register_type;
            const idCardPath = req.file.path;

            // Step 2: Update the appropriate table and set Valid_ID and Valid_Passport
            let updateQuery;
            if (registerType === 'captain') {
                updateQuery = `
                    UPDATE driver_information 
                    SET ID_Card = ?, Valid_ID = '1'
                    WHERE ID = ?
                `;
            } else if (registerType === 'bus_owner' || registerType === 'both') {
                updateQuery = `
                    UPDATE owner_information 
                    SET ID_Card = ?, Valid_ID = '1'
                    WHERE ID = ?
                `;
            } else {
                return res.status(400).json({ message: 'Invalid register_type for user' });
            }

            db.query(updateQuery, [idCardPath, userId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error updating ID card in database', error: err.sqlMessage });
                }

                res.status(200).json({
                    message: 'ID card uploaded and validation updated successfully',
                    filePath: idCardPath,
                });
            });
        });
    },
    multerErrorHandler // Attach multer error handler
);

module.exports = router;

/*

curl -X POST http://localhost:8888/upload/passport \
    -H "Authorization: Bearer <your_token>" \
    -F "passport=@/path/to/yourfile.jpg"

curl -X POST http://localhost:8888/upload/idcard \
    -H "Authorization: Bearer <your_token>" \
    -F "idcard=@/path/to/yourfile.png"

*/
