const mysql = require('mysql2/promise');
const { config } = require('../config/config');

const pool = mysql.createPool(config.mysql);

pool.getConnection((err, connection) => {
    if (err) {
      console.error('Failed to connect to database:', err);
    } else {
      console.log('Successful Connection');
      connection.release();
    }
});

async function db_query(query, params = []) {
    try {
        const [results] = await pool.query(query, params);
        
        return results;
    } catch (error) {
        console.error('Database Query Error:', error);
        throw error;
    }
}

async function db_get_field(query, params = []) {
    try {
        const [results] = await pool.query(query, params);

        if (results.length > 0) {
            const field = Object.values(results[0])[0]; 
            return field;
        }

        return null;
    } catch (error) {
        console.error('Error fetching field:', error);
        throw error;
    }
}


async function db_get_row(query, params = []) {
    try {
        
        const [results] = await pool.query(query, params);

        // Return the first row from the result set, or null if there are no results
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Error fetching row:', error);
        throw error;
    }
}

async function db_get_hash_single_array(query, params = []) {
    console.log(query);
    console.log(params);
    try {
        // Execute the query with the provided parameters using pool.query
        const [results] = await pool.query(query, params);

        // Convert the result into a hash map (key-value pairs)
        const hash = {};
        results.forEach(row => {
            const keys = Object.keys(row);
            if (keys.length >= 2) {
                hash[row[keys[0]]] = row[keys[1]]; // First column as key, second column as value
            }
        });

        return hash;

    } catch (error) {
        console.error('Error executing query:', error.message);
        throw error;  // Rethrow the error after logging it
    }
}

// async function test_db(){
//     const product = await db_get_row(
//         `SELECT tracking, amount, min_qty, max_qty, qty_step, list_qty_count, product
//          FROM shipway_logistics_products
//          LEFT JOIN shipway_logistics_product_descriptions ON shipway_logistics_product_descriptions.product_id = shipway_logistics_products.product_id
//          WHERE shipway_logistics_products.product_id = ? AND lang_code = ?`,
//         [2367, 'en']  
//     );
//     console.log(product);
//     return 0;
// }

// test_db();

module.exports = {
    db_query,
    db_get_field,
    db_get_row,
    db_get_hash_single_array
};
