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

    // Extract latitude and longitude from input strings and merge into one variable
    const startCoords = startLocation.split(',').map(coord => parseFloat(coord.trim()));
    const endCoords = endLocation.split(',').map(coord => parseFloat(coord.trim()));
    const currentCoords = currentLocation.split(',').map(coord => parseFloat(coord.trim()));

    try {
        // Fetch start point address from OpenStreetMap Nominatim API
        const startResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat: startCoords[1],
                lon: startCoords[0],
                format: 'json'
            }
        });

        // Fetch end point address from OpenStreetMap Nominatim API
        const endResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat: endCoords[1],
                lon: endCoords[0],
                format: 'json'
            }
        });

        // Fetch current point address from OpenStreetMap Nominatim API
        const currentResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat: currentCoords[1],
                lon: currentCoords[0],
                format: 'json'
            }
        });

        // Check if all geocoding requests were successful
        if (!startResponse.data || !endResponse.data || !currentResponse.data) {
            return res.status(400).json({ message: 'Unable to fetch location details from OpenStreetMap API' });
        }

        // Extract relevant information for start, end, and current locations
        const startAddress = startResponse.data.display_name || 'Unknown Address';
        const endAddress = endResponse.data.display_name || 'Unknown Address';
        const currentAddress = currentResponse.data.display_name || 'Unknown Address';

        // Merge latitude and longitude into single variables for each location
        const startLatLng = `${startCoords[1]},${startCoords[0]}`;
        const endLatLng = `${endCoords[1]},${endCoords[0]}`;
        const currentLatLng = `${currentCoords[1]},${currentCoords[0]}`;

        // Update the database with the location names and merged coordinates
        const query = `
            UPDATE trip_details
            SET 
                Start_name = ?, Start_Location = ?, 
                End_name = ?, End_Location = ?, 
                Current_name = ?, Current_Location = ?
            WHERE ID = ?
        `;
        db.query(
            query,
            [
                startAddress, startLatLng,
                endAddress, endLatLng,
                currentAddress, currentLatLng,
                tripId
            ],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
                }
                res.status(200).json({ message: 'Start, end, and current locations added successfully', data: result });
            }
        );
    } catch (error) {
        console.error('OpenStreetMap API Error:', error.message);
        res.status(500).json({ message: 'OpenStreetMap API error', error: error.message });
    }
});


// POST /trips/:tripId/stops - Add stop points to a trip
router.post('/trips/:tripId/stop-point', validateToken, async (req, res) => {
    const { tripId } = req.params;
    const { longitude, latitude } = req.body; // longitude and latitude sent from the front end

    if (!longitude || !latitude) {
        return res.status(400).json({ message: 'Longitude and Latitude are required' });
    }

    try {
        // Validate that longitude and latitude are numbers
        const lng = parseFloat(longitude);
        const lat = parseFloat(latitude);

        if (isNaN(lng) || isNaN(lat)) {
            return res.status(400).json({ message: 'Invalid longitude or latitude' });
        }

        // Fetch location name using a reverse geocoding API
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lat,
                lon: lng,
                format: 'json'
            }
        });

        if (!response.data || !response.data.display_name) {
            return res.status(400).json({ message: 'Unable to fetch location details from reverse geocoding API' });
        }

        const locationName = response.data.display_name;

        // Insert the stop point into the trip_route table
        const query = 'INSERT INTO trip_route (trip_id, name, latitude, longitude) VALUES (?, ?, ?, ?)';
        db.query(query, [tripId, locationName, lat, lng], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }
            res.status(201).json({
                message: 'Stop point added successfully',
                route_id: result.insertId,
                name: locationName,
                latitude: lat,
                longitude: lng
            });
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


module.exports = router;
