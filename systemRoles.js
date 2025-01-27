const db = require('./database'); // Make sure to import your database connection

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

const roleHierarchy = {
  super_admin: 3,
  admin: 2,
  user: 1
};

const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      // Validate that the required role exists in the hierarchy
      if (!roleHierarchy[requiredRole]) {
        console.error("Invalid required role:", requiredRole);  // Log invalid role
        return res.status(500).json({
          message: "Invalid role requirement in server configuration"
        });
      }

      const user_id = req.user?.ID;  // Assuming req.user is set by validateToken
      if (!user_id) {
        console.error("User ID not found in token.");  // Log missing user ID
        return res.status(403).json({
          message: "User ID not found in token"
        });
      }

      // Fetch the user's role from the database
      console.log("Fetching role for user ID:", user_id);
      const [user] = await dbQuery(`SELECT system_role FROM login WHERE ID = ?`, [user_id]);

      if (!user) {
        console.error("User not found in database for ID:", user_id);  // Log missing user
        return res.status(404).json({ message: "User not found in the database" });
      }

      const userRole = user.system_role;
      if (!userRole) {
        console.error("User role is missing for user ID:", user_id);  // Log missing role
        return res.status(403).json({ message: "User role is not defined in the database" });
      }

      console.log("User role:", userRole);

      // Check if the user's role exists in the role hierarchy
      if (!roleHierarchy[userRole]) {
        console.error("Unrecognized role:", userRole);  // Log unrecognized role
        return res.status(403).json({ message: "Your account role is not recognized by the system" });
      }

      // Compare the user's role with the required role
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        console.error("Insufficient permissions. User role:", userRole, "Required role:", requiredRole);  // Log insufficient permissions
        return res.status(403).json({
          message: `Insufficient permissions. Required role: ${requiredRole} or higher`,
          your_role: userRole,
          required_role: requiredRole
        });
      }
      req.user = user;
      next();  // Proceed if the role check passes
    } catch (err) {
      console.error("Error during role check:", err);  // Log role check errors
      return res.status(500).json({
        message: "Internal server error during authorization check",
        error: err.message  // Send detailed error message
      });
    }
  };
};

module.exports = requireRole;
