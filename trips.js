const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database'); // Import the database connection
const validateToken = require('./validateToken'); // Import the validation middleware
const axios = require('axios');

const router = express.Router();
// GET /trips/previous/:driverId - Fetch previous trips for a driver with bus information
router.get('/trips/previous/:driverId', validateToken, (req, res) => {
    const { driverId } = req.params;
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const query = `
        SELECT td.*, bi.ID AS Bus_ID, bi.Bus_Number, bi.Board_Symbol, bi.Driving_License_number, bi.passangers, bi.capacity,
               bi.Bus_Specification, bi.Air_Conditioner, bi.Image
        FROM trip_details td
        LEFT JOIN bus_information bi ON td.Bus_ID = bi.ID
        WHERE td.Driver_ID = ? AND CONCAT(td.Trip_Date, ' ', td.End_Time) < ?
        ORDER BY td.Trip_Date DESC, td.End_Time DESC
    `;

    db.query(query, [driverId, currentTime], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }
        res.status(200).json({ previousTrips: result });
    });
});

// GET /trips/next/:driverId - Fetch next trips for a driver with bus information
router.get('/trips/next/:driverId', validateToken, (req, res) => {
    const { driverId } = req.params;
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const query = `
        SELECT td.*, bi.ID AS Bus_ID, bi.Bus_Number, bi.Board_Symbol, bi.Driving_License_number, bi.passangers, bi.capacity,
               bi.Bus_Specification, bi.Air_Conditioner, bi.Image
        FROM trip_details td
        LEFT JOIN bus_information bi ON td.Bus_ID = bi.ID
        WHERE td.Driver_ID = ? AND CONCAT(td.Trip_Date, ' ', td.Start_Time) >= ?
        ORDER BY td.Trip_Date ASC, td.Start_Time ASC
    `;

    db.query(query, [driverId, currentTime], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }
        res.status(200).json({ nextTrips: result });
    });
});



// GET /trips/:tripId/details - Fetch trip details including stops and bus information
router.get('/trips/:tripId/details', validateToken, (req, res) => {
    const { tripId } = req.params;

    const tripQuery = `
        SELECT td.*, bi.ID AS Bus_ID, bi.Bus_Number, bi.Board_Symbol, bi.Driving_License_number, bi.passangers, bi.capacity,
               bi.Bus_Specification, bi.Air_Conditioner, bi.Image
        FROM trip_details td
        LEFT JOIN bus_information bi ON td.Bus_ID = bi.ID
        WHERE td.ID = ?
    `;

    const stopsQuery = `
        SELECT ID, name, latitude, longitude 
        FROM trip_route
        WHERE trip_id = ?
        ORDER BY ID ASC
    `;

    // Execute both queries
    db.query(tripQuery, [tripId], (err, tripResult) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        if (tripResult.length === 0) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        db.query(stopsQuery, [tripId], (err, stopsResult) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }

            res.status(200).json({
                tripDetails: tripResult[0],
                stops: stopsResult
            });
        });
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



// POST /trips/:tripId/start - Start a trip
router.post('/trips/:tripId/start', validateToken, (req, res) => {
    const { tripId } = req.params;

    const query = `
        UPDATE trip_details
        SET operation = 1, Start_Time = NOW()
        WHERE ID = ? AND operation = 0
    `;

    db.query(query, [tripId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Trip not found or already started' });
        }

        res.status(200).json({ message: 'Trip started successfully', tripId });
    });
});



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
    const { long, lat } = req.body; // longitude and latitude sent from the front end

    if (!longitude || !latitude) {
        return res.status(400).json({ message: 'Longitude and Latitude are required' });
    }

    try {
        // Validate that longitude and latitude are numbers
        const lng = parseFloat(longitude);
        const lats = parseFloat(lat);

        if (isNaN(lng) || isNaN(lat)) {
            return res.status(400).json({ message: 'Invalid longitude or latitude' });
        }

        // Fetch location name using a reverse geocoding API
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
            params: {
                lats,
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
        db.query(query, [tripId, locationName, lats, lng], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }
            res.status(201).json({
                message: 'Stop point added successfully',
                route_id: result.insertId,
                name: locationName,
                latitude: lats,
                longitude: lng
            });
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});




// GET /trips/live - Fetch live location data for operating trips
router.get('/trips/live', validateToken, (req, res) => {
    const query = `
        SELECT td.ID AS Trip_ID, td.Driver_ID, td.Start_Location, td.End_Location, 
               td.Trip_Date, td.Start_Time, td.End_Time, td.operation, 
               td.Current_Location, 
               bi.Bus_Number, bi.Board_Symbol, bi.Driving_License_number, 
               bi.Bus_Specification, bi.Air_Conditioner, bi.Image
        FROM trip_details td
        LEFT JOIN bus_information bi ON td.Bus_ID = bi.ID
        WHERE td.operation = 1
    `;

    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'No trips currently operating' });
        }

        res.status(200).json({
            liveTrips: result
        });
    });
});

// POST /trips/update-locations - Update live locations of all operating trips with random locations
router.post('/trips/update-locations', async (req, res) => {
    try {
        // Fetch all operating trips (operation = 1)
        const fetchTripsQuery = `SELECT ID FROM trip_details WHERE operation = 1`;
        
        db.query(fetchTripsQuery, async (err, trips) => {
            if (err) {
                return res.status(500).json({ message: 'Database error while fetching trips', error: err.sqlMessage });
            }

            if (trips.length === 0) {
                return res.status(404).json({ message: 'No operating trips found' });
            }

            // Generate random locations for each operating trip
            const updatePromises = trips.map(({ ID: tripId }) => {
                const latitude = (Math.random() * 180 - 90).toFixed(6); // Random latitude between -90 and 90
                const longitude = (Math.random() * 360 - 180).toFixed(6); // Random longitude between -180 and 180
                const currentLocation = `${latitude},${longitude}`;

                const updateQuery = `
                    UPDATE trip_details 
                    SET Current_Location = ?, Last_Updated = NOW() 
                    WHERE ID = ? AND operation = 1
                `;

                return new Promise((resolve, reject) => {
                    db.query(updateQuery, [currentLocation, tripId], (err, result) => {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            });

            // Execute all updates
            await Promise.all(updatePromises);

            res.status(200).json({ message: 'All operating trip locations updated successfully with random locations' });
        });
    } catch (error) {
        console.error('Error updating locations:', error);
        res.status(500).json({ message: 'Failed to update locations', error: error.message });
    }
});



module.exports = router;
