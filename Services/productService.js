
const {unserialize} = require('php-serialize');
const { db_query } = require('../Model/mysql');

async function fn_update_product(product_data, product_id = 0) {
    if (!product_data || typeof product_data !== 'object') {
        throw new Error('Invalid product data');
    }

    // *************** Sanitize product data *****************
    
    // Determine if this is a new product or an update
    let create = false;
    const currentTime = Math.floor(Date.now() / 1000);

    if (!product_id) {
        create = true;
    }
    else {
        product_data.updated_timestamp = currentTime; 
    }

    // Timestamp handling
    if (create) {
        product_data.timestamp = currentTime;
    } else if (product_data.timestamp) {
        product_data.timestamp = Math.floor(new Date(product_data.timestamp).getTime() / 1000);
    } else {
        delete product_data.timestamp;
    }

    // Handle `avail_since`
    if (product_data.avail_since) {
        product_data.avail_since = Math.floor(new Date(product_data.avail_since).getTime() / 1000);
    }

    // Serialize `tax_ids`
    if (product_data.tax_ids) {
        product_data.tax_ids = JSON.stringify(product_data.tax_ids);
    }

    // Serialize `localization`
    if (product_data.localization) {
        product_data.localization = JSON.stringify(product_data.localization);
    }

    // Convert `usergroup_ids` to a comma-separated string
    if (product_data.usergroup_ids) {
        product_data.usergroup_ids = product_data.usergroup_ids.length === 0 ? '0' : product_data.usergroup_ids.join(',');
    }

    // Ensure `list_qty_count` and `qty_step` are non-negative
    if (product_data.list_qty_count && product_data.list_qty_count < 0) {
        product_data.list_qty_count = 0;
    }
    if (product_data.qty_step && product_data.qty_step < 0) {
        product_data.qty_step = 0;
    }

    // Round `min_qty` and `max_qty` to step
    if (product_data.min_qty) {
        product_data.min_qty = Math.ceil(product_data.min_qty / (product_data.qty_step || 1)) * (product_data.qty_step || 1);
    }
    if (product_data.max_qty) {
        product_data.max_qty = Math.ceil(product_data.max_qty / (product_data.qty_step || 1)) * (product_data.qty_step || 1);
    }

    let shipping_params = {
        min_items_in_box: 0,
        max_items_in_box: 0,
        box_length: 0,
        box_width: 0,
        box_height: 0
    };

    if (product_id) {
        const existingParams = await db_query('SELECT shipping_params FROM shipway_logistics_products WHERE product_id = ?', product_id);
        if (existingParams) {
            const serializedString = existingParams[0].shipping_params.toString('utf8');
            shipping_params = unserialize(serializedString);
        }
        // console.log(shipping_params);
        create = true;
    }

    // return product_id;

    // Serialize the shipping parameters
    product_data.shipping_params = shipping_params;

    let query, result;
    let {product, category_ids, main_category, price , ..._product_data} = product_data;
    _product_data.facebook_obj_type = 'facebook_obj_type';
    _product_data.buy_now_url = 'buy_now_url';

    if (create) {
        if(!product_data.product || product_data.product_id){
            return false;
        }






        // **************** product, category_ids, main_category, price fields are missing in table *******************
        // **************** facebook_obj_type,buy_now_url fields are missing in product_data ******************






        query = `INSERT INTO shipway_logistics_products SET ?`;
        result = await db_query(query, [_product_data]);

        product_id = result.insertId;

        // **************** Don't need to enter this description as all fields are empty ****************************

        // Insert product descriptions for all languages (assumes a separate table)

        // const lang_code = 'en';
        // const descriptionData = { product: product_data.product, product_id, lang_code };





        // **************** descriptionData has a lot of unnecessary data and a lot of missing fields ****************





        // await db_query("INSERT INTO shipway_logistics_product_descriptions SET ?", [descriptionData]);
    } else {
        // Update existing product

        query = "UPDATE shipway_logistics_products SET ? WHERE product_id = ?";
        result = await db_query(query, [_product_data, product_id]);

        if(result == 0){
            product_id = 0;
        }

        
        
        
        
        // ******************** descriptions table seems to be unnecessary ************************
        
        
        
        
        
        // Update product descriptions
        // await db_query("UPDATE shipway_logistics_product_descriptions SET ? WHERE product_id = ? AND lang_code = ?", [_product_data, product_id, 'en']);
    }

    
    if(product_id){
        await update_product_categories(product_id, product_data);

        product_data = await update_product_prices(product_id, product_data);
    }

    return product_id;
}

async function update_product_categories(product_id, product_data) {
    if (!product_data.category_ids || product_data.category_ids.length === 0) {
        throw new Error('No category IDs provided');
    }

    const queries = product_data.category_ids.map(cid => {
        const linkType = product_data.main_category === cid ? 'M' : 'A';
        const queryData = {
            product_id: product_id,
            category_id: cid,
            position: 0,
            link_type: linkType
        };

        return db_query("INSERT INTO shipway_logistics_products_categories SET ?", queryData);
    });

    try {
        await Promise.all(queries);
    } catch (error) {
        console.error('Error updating product categories:', error.message);
        throw new Error('Failed to update product categories');
    }
}

async function update_product_prices(product_id, product_data, company_id = 0) {
    let skipPriceDelete = false;
    let prices = [];

    if (product_data.price !== undefined) {
        const basePrice = {
            price: Math.abs(product_data.price),
            lower_limit: 1,
        };

        if (!product_data.prices) {
            product_data.prices = [basePrice];
            skipPriceDelete = true;
        } else {
            prices = product_data.prices.slice(1);
            prices.unshift(basePrice);
        }
    }

    if (product_data.prices && product_data.prices.length > 0) {
        const tableName = 'shipway_logistics_product_prices ';

        if (!skipPriceDelete) {
            try {
                await db_query(`DELETE FROM ${tableName} WHERE product_id = ?`, [product_id]);
            } catch (error) {
                console.error('Error deleting old prices:', error.message);
                throw new Error('Failed to delete old prices');
            }
        }

        for (const price of product_data.prices) {
            const priceData = {
                ...price,
                type: price.type || 'A',
                usergroup_id: price.usergroup_id || 0,
                product_id,
            };

            if (priceData.lower_limit === 1 && priceData.type === 'P' && priceData.usergroup_id === 0) {
                console.warn('Warning: Cannot save percentage price with lower limit 1 and usergroup_id 0');
                continue;
            }

            if (priceData.lower_limit !== undefined) {
                if(company_id){
                    priceData.company_id = company_id;
                }
                if (priceData.type === 'P') {
                    priceData.percentage_discount = Math.min(100, priceData.price);
                    priceData.price = product_data.price;
                }
                delete priceData.type;

                try {
                    if (product_data.prices.length === 1 && skipPriceDelete && !product_data.create) {
                        await db_query(
                            `UPDATE ${tableName} SET ? WHERE product_id = ? AND ((lower_limit = 1 AND usergroup_id = 0) OR percentage_discount > 0)`,
                            [priceData, product_id]
                        );
                    } else {
                        await db_query(`REPLACE INTO ${tableName} SET ?`, [priceData]);
                    }
                } catch (error) {
                    console.error('Error updating/inserting prices:', error.message);
                    throw new Error('Failed to update or insert prices');
                }
            }
        }
    }

    return product_data;
}

module.exports = { 
    fn_update_product,
    update_product_categories,
    update_product_prices
};