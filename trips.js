const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database'); // Import the database connection
const validateToken = require('./validateToken'); // Import the validation middleware
const axios = require('axios');

const router = express.Router();
// GET /trips/previous/:driverId - Fetch previous trips for a driver
router.get('/trips/previous/:driverId', validateToken, (req, res) => {
    const { driverId } = req.params;
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    const query = `
        SELECT * FROM trip_details 
        WHERE Driver_ID = ? AND CONCAT(Trip_Date, ' ', End_Time) < ?
        ORDER BY Trip_Date DESC, End_Time DESC
    `;

    db.query(query, [driverId, currentTime], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }
        res.status(200).json({ previousTrips: result });
    });
});

// GET /trips/next/:driverId - Fetch next trips for a driver
router.get('/trips/next/:driverId', validateToken, (req, res) => {
    const { driverId } = req.params;
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const query = `
        SELECT * FROM trip_details 
        WHERE Driver_ID = ? AND CONCAT(Trip_Date, ' ', Start_Time) >= ?
        ORDER BY Trip_Date ASC, Start_Time ASC
    `;

    db.query(query, [driverId, currentTime], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }
        res.status(200).json({ nextTrips: result });
    });
});
router.get('/trips/:tripId/stops', validateToken, (req, res) => {
    const { tripId } = req.params;

    const query = 'SELECT * FROM stop_points WHERE trip_id = ?';
    db.query(query, [tripId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }
        res.status(200).json({ stops: result });
    });
});



// POST /trips - Create a new trip
router.post(
    '/trips/new',
    validateToken,
    [
        body('date').notEmpty().withMessage('Date is required'),
        body('time').notEmpty().withMessage('Time is required'),
        body('passenger_type').isIn(['Male', 'Female', 'Both']).withMessage('Passenger type is invalid'),
        body('subscription_type').notEmpty().withMessage('Subscription type is required'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { date, time, passenger_type, subscription_type } = req.body;
        const query = 'INSERT INTO trips (date, time, passenger_type, subscription_type) VALUES (?, ?, ?, ?)';
        
        db.query(query, [date, time, passenger_type, subscription_type], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }
            res.status(201).json({
                message: 'Trip created successfully',
                trip_id: result.insertId,
            });
        });
    }
);


/*
Example:
{
  "startLatitude": 23.5859,
  "startLongitude": 58.4059,
  "endLatitude": 23.6100,
  "endLongitude": 58.5450,
  "startAddress": "Seeb, Muscat",
  "endAddress": "Al Maabilah, Muscat"
}
*/

// POST /trips/:tripId/start-end-current - Set start, end, and current locations for a trip using coordinates
router.post('/trips/:tripId/start-end-current', validateToken, async (req, res) => {
    const { tripId } = req.params;
    const { startLocation, endLocation, currentLocation } = req.body;

    if (!startLocation || !endLocation || !currentLocation) {
        return res.status(400).json({ message: 'Start, End, and Current locations are required' });
    }

    // Extract latitude and longitude from input strings
    const [startLng, startLat] = startLocation.split(',').map(coord => parseFloat(coord.trim()));
    const [endLng, endLat] = endLocation.split(',').map(coord => parseFloat(coord.trim()));
    const [currentLng, currentLat] = currentLocation.split(',').map(coord => parseFloat(coord.trim()));

    const googleApiKey = 'AIzaSyBzN9xUNw3IX7dMeQNe1qESO4MHo8ktrDU'; // 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao';

    try {
        // Fetch start point address from Google Maps Geocoding API `https://maps.googleapis.com/maps/api/geocode/json`
        const startResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                latlng: `${startLat},${startLng}`,
                key: googleApiKey
            }
        });

        // Fetch end point address from Google Maps Geocoding API
        const endResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                latlng: `${endLat},${endLng}`,
                key: googleApiKey
            }
        });

        // Fetch current point address from Google Maps Geocoding API
        const currentResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                latlng: `${currentLat},${currentLng}`,
                key: googleApiKey
            }
        });
        
        console.log(startResponse.data,startResponse.data.status)
        // Check if all geocoding requests were successful
        if (startResponse.data.status !== 'OK' || endResponse.data.status !== 'OK' || currentResponse.data.status !== 'OK') {
            return res.status(400).json({ message: 'Unable to fetch location details from Google Maps API' });
        }
        
        // Extract relevant information for start, end, and current locations
        const startAddress = startResponse.data.results[0].formatted_address;
        const endAddress = endResponse.data.results[0].formatted_address;
        const currentAddress = currentResponse.data.results[0].formatted_address;

        // Insert the start, end, and current points into the database
        const query = `
            UPDATE trip_details
            SET start_location = ?, start_latitude = ?, start_longitude = ?, 
                end_location = ?, end_latitude = ?, end_longitude = ?,
                current_location = ?, current_latitude = ?, current_longitude = ?
            WHERE ID = ?
        `;
        db.query(
            query,
            [
                startAddress, startLat, startLng,
                endAddress, endLat, endLng,
                currentAddress, currentLat, currentLng,
                tripId
            ],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
                }
                res.status(200).json({ message: 'Start, end, and current locations added successfully' });
            }
        );
    } catch (error) {
        console.error('Google Maps API Error:', error.message);
        res.status(500).json({ message: 'Google Maps API error', error: error.message });
    }
});

module.exports = router;




// POST /trips/:tripId/stops - Add stop points to a trip
router.post('/trips/:tripId/stops', validateToken, async (req, res) => {
    const { tripId } = req.params;
    const { placeId } = req.body; // placeId is sent from the front end after user selects a location on the map

    if (!placeId) {
        return res.status(400).json({ message: 'Place ID is required' });
    }

    // Google Maps Geocoding API URL
    const googleApiKey = 'AIzaSyBzN9xUNw3IX7dMeQNe1qESO4MHo8ktrDU';
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${googleApiKey}`;
    //const googleUrl = 'https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=initMap'
    try {
        console.log(response.data)
        // Fetch location details from Google Maps API
        const response = await axios.get(googleUrl);
        if (response.data.status !== 'OK') {
            return res.status(400).json({ message: 'Unable to fetch location details', error: response.data.status });
        }

        const locationData = response.data.results[0];
        const { formatted_address, geometry } = locationData;
        const { lat, lng } = geometry.location;

        // Insert the stop point into the database
        const query = 'INSERT INTO stop_points (trip_id, name, latitude, longitude) VALUES (?, ?, ?, ?)';
        db.query(query, [tripId, formatted_address, lat, lng], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }
            res.status(201).json({
                message: 'Stop point added successfully',
                stop_point_id: result.insertId,
            });
        });
    } catch (error) {
        console.error('Google Maps API Error:', error.message);
        res.status(500).json({ message: 'Google Maps API error', error: error.message });
    }
});




module.exports = router;
