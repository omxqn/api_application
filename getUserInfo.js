// getUserInfo.js
const db = require('./db'); // adjust to your db connection file path

/**
 * Fetches user information by email or phone number.
 * @param {string} contactInfo - The user's email or phone number.
 * @param {function} callback - Callback function with error and result parameters.
 */
const getUserInfo = (contactInfo, callback) => {
    const query = `SELECT * FROM login WHERE Email = ? OR Phone_number = ?`;

    db.query(query, [contactInfo, contactInfo], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        if (results.length === 0) {
            return callback(null, null); // No user found
        }

        return callback(null, results[0]); // Return first matching user
    });
};

module.exports = getUserInfo;
