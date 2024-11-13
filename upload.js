const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const db = require('./database'); // Assuming you have a database module
const validateToken = require('./validateToken'); 

const router = express.Router();

// Configure multer storage for passport uploads
const passportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/passports'); // Folder for passport files
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
        cb(null, 'uploads/idcards'); // Folder for ID card files
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const idCardUpload = multer({ storage: idCardStorage });

// Endpoint for uploading passport
router.post(
    '/upload/passport',validateToken, 
    passportUpload.single('passport'), 
    [
        body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').optional().isMobilePhone().withMessage('Invalid phone number')
    ],
    (req, res) => {
        console.log("File:", req.file);
        if (!req.file) {
            return res.status(400).json({ message: 'No passport file uploaded' });
        }

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
            query = 'SELECT * FROM driver_information WHERE email = ?';
            params = [email];
        } else {
            query = 'SELECT * FROM driver_information WHERE phone_number = ?';
            params = [phone_number];
        }

        db.query(query, params, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            if (result.length === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            const userId = result[0].ID;
            const passportPath = req.file.path;

            // Update passport path in the database
            const updateQuery = 'UPDATE driver_information SET Passport = ? WHERE ID = ?';
            db.query(updateQuery, [passportPath, userId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
                }

                res.status(200).json({
                    message: 'Passport uploaded successfully',
                    filePath: passportPath
                });
            });
        });
    }
);

// Endpoint for uploading ID card
router.post(
    '/upload/idcard', validateToken,
    idCardUpload.single('idcard'), 
    [
        body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
        body('phone_number').optional().isMobilePhone().withMessage('Invalid phone number')
    ],
    (req, res) => {
        console.log("File:", req.file);
        if (!req.file) {
            return res.status(400).json({ message: 'No ID card file uploaded' });
        }

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
            query = 'SELECT * FROM driver_information WHERE email = ?';
            params = [email];
        } else {
            query = 'SELECT * FROM driver_information WHERE phone_number = ?';
            params = [phone_number];
        }

        db.query(query, params, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            if (result.length === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            const userId = result[0].ID;
            const idCardPath = req.file.path;

            // Update ID card path in the database
            const updateQuery = 'UPDATE driver_information SET ID_Card = ? WHERE ID = ?';
            db.query(updateQuery, [idCardPath, userId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
                }

                res.status(200).json({
                    message: 'ID card uploaded successfully',
                    filePath: idCardPath
                });
            });
        });
    }
);



/*

curl -X POST http://localhost:8888/upload/passport \
    -F "passport=@C:/Users/MTC Admin/Desktop/sayyar_api/test.jpg" \
    -F "email=omxqn12@gmail.com"


*/

module.exports = router;
