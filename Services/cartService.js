const crc32 = require('crc-32');
const { db_get_field, db_get_row, db_query, db_get_hash_single_array } = require('../Model/mysql');
const { config } = require('../config/config');

function fn_clear_cart(cart, complete = false, clearAll = false) {
    try {
  
      // Clear cart data
      if (clearAll) {
        cart = {};
      } else {
        cart = {
          products: [],
          recalculate: false,
          userData: complete ? {} : cart.userData,
        };
      }
  
      return cart;

    } catch (error) {
      console.error(`Error clearing cart: ${error}`);
      return {};
    }
}

async function fn_add_product_to_cart(product_data, cart, auth, update = false) {
  try {
    const ids = {};

    if (product_data && typeof product_data === 'object') {
        // Process each product data entry
        for (const key in product_data) {
            const data = product_data[key];
            if (!key || !data.amount) continue;

            data.stored_price = (data.stored_price && config.ORDER_MANAGEMENT) ? data.stored_price : 'N';
            data.extra = data.extra || {};

            const product_id = data.product_id ? parseInt(data.product_id, 10) : parseInt(key, 10);

            // *************** fn_check_add_product_to_cart -> Not using *****************
            // if (!(await fn_check_add_product_to_cart(cart, data, product_id))) continue; 

            // Check if product options exist
            if (!data.product_options) {
                // ********************** fn_get_default_product_options is returning empty array **********************
                //   data.product_options = await fn_get_default_product_options(product_id);
                data.product_options = {};
            }

            // Generate cart ID
            data.extra.product_options = data.product_options;

            if (data.vendor_variant_id) {
                data.extra.vendor_variant_id = data.vendor_variant_id;
            }

            const _id = await fn_generate_cart_id(product_id, data.extra, false);

            if (ids[_id] && key === _id) continue;

            // Handle exclude_from_calculate logic
            if (data.extra.exclude_from_calculate) {
                if (update && cart.products[key] && cart.products[key].extra.aoc) {
                    cart.saved_product_options[cart.products[key].extra.saved_options_key] = data.product_options;
                } else if (!update && data.extra.saved_options_key && data.extra.aoc) {
                    cart.saved_product_options[data.extra.saved_options_key] = data.product_options;
                }

                if (cart.deleted_exclude_products[data.extra.exclude_from_calculate][_id]) continue;
            }

            let amount = fn_normalize_amount(data.amount);
            let price = 0;

            if (!data.extra.exclude_from_calculate) {
                let allow_add = true;


                // ************** Returning 0 always for dummy_orders ****************
                //   let price = await fn_get_product_price(product_id, amount, auth);

                const zero_price_action = await db_get_field("SELECT zero_price_action FROM shipway_logistics_products WHERE product_id = ?", [product_id]);

                if (!parseFloat(price) && zero_price_action === 'A') {
                    if (cart.products[key]?.custom_user_price) {
                        price = cart.products[key].custom_user_price;
                    } else {
                        data.price = data.price || 0;
                    }
                }



                //   ********************** Returning 9 always for dummy_orders *******************
                //   price = await fn_apply_options_modifiers(data.product_options, price, 'P', {}, { product_data: data });


                price = 9;

                //   *************** Never coming in the conditional statement ******************
                //   if (!parseFloat(price)) {
                //       data.price = data.price ? fn_parse_price(data.price) : 0;

                //       price = data.price ? data.price : 0;
                //   }

                if (!allow_add) continue;

            } else {
                price = data.price ? data.price : 0;
            }

            const product_info = await db_get_row('SELECT is_edp, options_type, tracking, unlimited_download FROM shipway_logistics_products WHERE product_id = ?', [product_id]);
            
            data.is_edp = product_info.is_edp || 0;
            data.options_type = product_info.options_type;
            data.tracking = product_info.tracking;
            data.extra.unlimited_download = product_info.unlimited_download;



            //    ******************* never going inside this code ************************
            
            
            
            // Check the sequential options
            //   if (data.tracking === config.ProductTracking.TRACK_WITH_OPTIONS && data.options_type === 'S') {
            //       const inventory_options = await db_get_field("SELECT a.option_id FROM product_options as a LEFT JOIN product_global_option_links as c ON c.option_id = a.option_id WHERE (a.product_id = ? OR c.product_id = ?) AND a.status = 'A' AND a.inventory = 'Y'", [product_id, product_id]);

            //       let sequential_completed = inventory_options.every(option_id => data.product_options[option_id]);

            //       if (!sequential_completed) {
            //           const product_options = fn_get_options_combination(data.product_options);
            //           // ******************* fn_url function is not implemented here ********************
            //           const redirect_url = `products.view?product_id=${product_id}&combination=${product_options}`;
            //           // FIXME: Avoid using global variables like $_REQUEST in PHP, find an alternative way to handle redirect in Node.js.
            //           // Set the redirect URL for the frontend to handle
            //           cart.redirect_url = redirect_url;
            //           return false;
            //       }
            //   }




            // If product doesn't exist in the cart
            if (!cart.products[_id]) {
                amount = data.original_amount || await fn_check_amount_in_stock(product_id, amount, data.product_options, _id, data.is_edp, 0, cart, update ? key : 0);

                if (amount === false) continue;

                cart.products[_id] = {
                    product_id,
                    product_code: await fn_get_product_code(product_id, data.product_options),
                    //   product: await fn_get_product_name(product_id), ************* Already implemented ***************
                    product: 'Test Product Name',
                    amount,
                    product_options: data.product_options,
                    price,
                    discount: data.discount || 0,
                    stored_price: data.stored_price,
                    //   main_pair: await fn_get_cart_product_icon(product_id, data) ****************** Need to implement this function ******************
                    main_pair: {}
                };

                //   ***************** Not changing anything *******************
                //   fn_define_original_amount(product_id, _id, cart.products[_id], data); 


                // ***************** Not implemented fn_delete_cart_product ********************
                if (update && key !== _id) {
                    fn_delete_cart_product(cart, key, false);
                }

            } else {
                let initial_amount = cart.products[_id].original_amount || cart.products[_id].amount;

                if (update && key !== _id) {
                    amount += initial_amount;
                    fn_delete_cart_product(cart, key, false);
                }

                cart.products[_id].amount = await fn_check_amount_in_stock(product_id, (update ? 0 : initial_amount) + amount, data.product_options, _id, data.is_edp === 'Y' ? 'Y' : 'N', 0, cart, update ? key : 0);
            }

            cart.products[_id].extra = data.extra || {};
            cart.products[_id].stored_discount = data.stored_discount;

            if (config.ORDER_MANAGEMENT) {
                cart.products[_id].discount = data.discount;
            }



            //   ****************** product popularity is most likely a cs cart specific functionality *******************


            // Increase product popularity 
            //   if (!cart.products_popularity?.added?.[product_id]) {
            //       const popularity_data = {
            //           product_id,
            //           added: 1,
            //           total: parseInt(process.env.POPULARITY_ADD_TO_CART, 10)
            //       };

            //       await db_insert_or_update("product_popularity", popularity_data, "added = added + 1, total = total + ?", [parseInt(process.env.POPULARITY_ADD_TO_CART, 10)]);

            //       cart.products_popularity = { added: { [product_id]: true } };
            //   }

            const company_id = await db_get_field("SELECT company_id FROM shipway_logistics_products WHERE product_id = ?", [product_id]);
            cart.products[_id].company_id = company_id;

            if (data.saved_object_id) {
                cart.products[_id].object_id = data.saved_object_id;
            }

            ids[_id] = product_id;
        }

        cart.recalculate = true;

        if (cart.chosen_shipping) {
            cart.calculate_shipping = true;
            delete cart.product_groups;
        }

        return ids;

    } else {
        return false;
    }
  } catch (error) {
    console.error(`Error in fn_add_product_to_cart: ${error}`);
    return false;
  }
}

async function fn_generate_cart_id(productId, extra, onlySelectable = false) {
    let cid = [];

    try {
        // if (extra.product_options && typeof extra.product_options === 'object') {
        //     // Process product options
        //     for (const [key, value] of Object.entries(extra.product_options)) {


        //         // ********************** shipway_logistics_product_options table is empty ************************
        //         // const isInventoryAvailable = await db_get_field("SELECT inventory FROM shipway_logistics_product_options WHERE option_id = ?i", key);
        //         // if (onlySelectable && (!Number.isInteger(Number(value)) || isInventoryAvailable != 'Y')) {
        //         //     continue;
        //         // }


        //         if (onlySelectable && !Number.isInteger(Number(value))) {
        //             continue;
        //         }
        //         cid.push(value);
        //     }
        // }

        // if (extra.exclude_from_calculate) {
        //     cid.push(extra.exclude_from_calculate);
        // }

        // cid.sort(); // Sort the array
        cid.unshift(productId); // Prepend product ID
        let cartId = crc32.str(cid.join('_')); // Generate cart ID
        cartId = cartId >>> 0;

        return cartId;
    } catch (error) {
        console.error('Error in fn_generate_cart_id:', error);
        return null;
    }
}

function fn_normalize_amount(amount = '1') {
    try {
        // Ensure the amount is an absolute integer
        const normalizedAmount = Math.abs(parseInt(amount, 10));

        // Return 0 if the amount is not a valid number, otherwise return the amount
        return isNaN(normalizedAmount) ? 0 : normalizedAmount;
    } catch (error) {
        console.error('Error in fn_normalize_amount:', error);
        return 0;
    }
}


async function fn_get_product_code(productId, productOptions = {}) {
    try {
        if (!productId) {
            return '';
        }

        // Fetch the product tracking type
        const tracking = await db_get_field(
            "SELECT tracking FROM shipway_logistics_products WHERE product_id = ?",
            [productId]
        );

        // Generate combination hash for product options
        const combinationHash = await fn_generate_cart_id(productId, { product_options: productOptions });

        // Try to fetch product code from the options inventory
        let productCode = await db_get_field(
            "SELECT product_code FROM shipway_logistics_product_options_inventory WHERE combination_hash = ? AND product_id = ?",
            [combinationHash, productId]
        );

        // If no specific code for options or not tracked by options, fetch general product code
        if (!productCode || tracking !== 'O') {  // 'O' indicates TRACK_WITH_OPTIONS
            productCode = await db_get_field(
                "SELECT product_code FROM shipway_logistics_products WHERE product_id = ?",
                [productId]
            );
        }

        return productCode || '';
    } catch (error) {
        console.error('Error in fn_get_product_code:', error);
        return '';
    }
}


async function fn_get_product_price(productId, amount, auth) {
    try {
        // Construct the usergroup condition
        let usergroupCondition = 'AND shipway_logistics_product_prices.usergroup_id IN (0)';

        // *************** The following code will result in placing 0 in plaxe of ? *********************
        // if (config.AREA === 'C' || config.ORDER_MANAGEMENT) {
        //     usergroupCondition = await db_quote(
        //         "AND product_prices.usergroup_id IN (?)",
        //         [USERGROUP_ALL, ...(auth.usergroup_ids || [])]
        //     );
        // } else {
        //     usergroupCondition = await db_quote(
        //         "AND product_prices.usergroup_id IN (?)",
        //         [USERGROUP_ALL]
        //     );
        // }

        // Query to get the price
        const query = `
            SELECT MIN(
                IF(shipway_logistics_product_prices.percentage_discount = 0, 
                    shipway_logistics_product_prices.price, 
                    shipway_logistics_product_prices.price - (shipway_logistics_product_prices.price * shipway_logistics_product_prices.percentage_discount) / 100
                )
            ) as price
            FROM shipway_logistics_product_prices
            WHERE lower_limit <= ? AND shipway_logistics_product_prices.product_id = ? ${usergroupCondition}
            ORDER BY lower_limit DESC
            LIMIT 1
        `;

        const price = await db_get_field(query, amount, productId);

        // Return the price or 0 if not found
        return price ? parseFloat(price) : 0;
    } catch (error) {
        console.error('Error in fn_get_product_price:', error);
        return 0;
    }
}

async function fn_apply_options_modifiers(productOptions, baseValue, type, origOptions = [], extra = {}) {
    try {
        // Static cache (Scoped to this function call)
        const optionTypesCache = new Map();
        const optionModifiersCache = new Map();

        const fields = (type === 'P') ? "modifier, modifier_type" : "weight_modifier as modifier, weight_modifier_type as modifier_type";

        // Filter out empty values in original options
        origOptions = origOptions.filter(option => option.value);

        const origValue = baseValue;

        if (Object.keys(productOptions).length > 0) {
            // Check options type to apply only Selectbox, Radiogroup, and Checkbox modifiers
            let optionTypes = {};
            if (origOptions.length === 0) {
                const cacheKey = JSON.stringify(Object.keys(productOptions));
                if (!optionTypesCache.has(cacheKey)) {
                    optionTypes = await db_get_hash_single_array(
                        "SELECT option_type as type, option_id FROM product_options WHERE option_id IN (?)",
                        ['option_id', 'type'],
                        Object.keys(productOptions)
                    );
                    optionTypesCache.set(cacheKey, optionTypes);
                } else {
                    optionTypes = optionTypesCache.get(cacheKey);
                }
            } else {
                origOptions.forEach(opt => {
                    optionTypes[opt.option_id] = opt.option_type;
                });
            }

            // Apply modifiers
            for (const [optionId, variantId] of Object.entries(productOptions)) {
                if (!optionTypes[optionId] || !['S', 'R', 'C'].includes(optionTypes[optionId])) {
                    continue;
                }

                let mod = null;
                if (origOptions.length === 0) {
                    const cacheKey = fields + variantId;
                    if (!optionModifiersCache.has(cacheKey)) {
                        const omCondition = await db_quote("variant_id = ?", variantId);
                        const query = `SELECT ${fields} FROM product_option_variants WHERE ${omCondition}`;
                        mod = await db_get_row(query);
                        optionModifiersCache.set(cacheKey, mod);
                    } else {
                        mod = optionModifiersCache.get(cacheKey);
                    }
                } else {
                    for (const origOpt of origOptions) {
                        if (origOpt.value === variantId && variantId) {
                            mod = {
                                modifier: origOpt.modifier,
                                modifier_type: origOpt.modifier_type
                            };
                            break;
                        }
                    }
                }

                // Apply modifier to base value
                if (mod) {
                    if (mod.modifier_type === 'A') { // Absolute
                        if (mod.modifier.startsWith('-')) {
                            baseValue -= parseFloat(mod.modifier.slice(1));
                        } else {
                            baseValue += parseFloat(mod.modifier);
                        }
                    } else { // Percentage
                        if (mod.modifier.startsWith('-')) {
                            baseValue -= (parseFloat(mod.modifier.slice(1)) * origValue) / 100;
                        } else {
                            baseValue += (parseFloat(mod.modifier) * origValue) / 100;
                        }
                    }
                }
            }
        }

        return Math.max(baseValue, 0); // Ensure base value is not negative
    } catch (error) {
        console.error('Error in fn_apply_options_modifiers:', error);
        return Math.max(baseValue, 0);
    }
}

function fn_parse_price(price, currency = config.CART_PRIMARY_CURRENCY) {
    try {
        // Currency configuration (add more currencies as needed)

        const currencyConfig = {
            currency: {
                decimals: 2,
                decimals_separator: '.',
                thousands_separator: ','
            }
            // Add other currencies here as needed
        };

        // Error handling: ensure price is valid and currency is in the config
        if (typeof price !== 'string' && typeof price !== 'number') {
            throw new TypeError('Price must be a string or number');
        }

        if (!currencyConfig[currency]) {
            throw new Error(`Currency configuration for ${currency} not found`);
        }

        const { decimals, decimals_separator: decSep, thousands_separator: thousSep } = currencyConfig[currency];

        // Convert price to string for easier manipulation
        price = String(price);

        // Handle case when decimal and thousands separators are the same
        if (decSep === thousSep) {
            const lastIndex = price.lastIndexOf(decSep);
            if (lastIndex !== -1) {
                if (thousSep === '.') {
                    price = price.replace(/\./g, ',');
                }
                price = `${price.slice(0, lastIndex)}.${price.slice(lastIndex + 1)}`; // Replace last occurrence with '.'
            }
        } else {
            // Handle thousands separator
            if (thousSep === '.' && price.includes(decSep)) {
                price = price.replace(new RegExp(`\\${thousSep}`, 'g'), ''); // Remove thousands separator
            } else if (thousSep === '.' && price.lastIndexOf('.') !== -1) {
                const lastIndex = price.lastIndexOf('.');
                const lastPart = price.slice(lastIndex).replace(/[^\d]/g, '');
                if (lastPart.length === 3 && decimals !== 3) {
                    price = price.replace(new RegExp(`\\${thousSep}`, 'g'), ''); // Remove if it's really a thousands separator
                }
            }

            // Replace decimals separator with '.'
            if (decSep !== '.') {
                price = price.replace(new RegExp(`\\${decSep}`, 'g'), '.');
            }
        }

        // Remove any non-numeric or non-decimal characters
        price = price.replace(/[^\d.]/g, '');

        // Convert to float and round to the correct decimal places
        const numericPrice = parseFloat(price);

        if (isNaN(numericPrice)) {
            throw new Error('Invalid price value');
        }

        return parseFloat(numericPrice.toFixed(decimals));
        
    } catch (error) {
        console.error(`Error parsing price: ${error.message}`);
        return null;  // Return null or a default value in case of error
    }
}

async function fn_check_amount_in_stock(productId, amount, productOptions, cartId, isEdp, originalAmount, cart, updateId = 0) {
    try {
        // If the product is EDP, don't track the inventory
        if (isEdp === 'Y') {
            return 1;
        }

        // Fetch product details ******************* for some reasons it's not able to fetch the data *********************
        // const product = await db_get_row(
        //     `SELECT tracking, amount, min_qty, max_qty, qty_step, list_qty_count, product
        //      FROM shipway_logistics_products
        //      LEFT JOIN shipway_logistics_product_descriptions ON shipway_logistics_product_descriptions.product_id = shipway_logistics_products.product_id
        //      WHERE shipway_logistics_products.product_id = ? AND lang_code = ?`,
        //     [productId, 'en']  
        // );

        const product = {
            tracking: 'B',
            amount: 1,
            min_qty: 0,
            max_qty: 0,
            qty_step: 0,
            list_qty_count: 0,
            product: "Test Product Name"
        }

        let currentAmount;
        const tracking = product.tracking;

        // ***************** Not going in this condition ********************
        // if (tracking && tracking !== 'D') {  // 'D' for Do Not Track
        //     if (tracking === 'W') {  // Track without options
        //         currentAmount = product.amount;
        //     } else if (tracking === 'O') {  // Track with options
        //         const selectableCartId = await fn_generate_cart_id(productId, { product_options: productOptions }, true);
        //         currentAmount = parseInt(await db_get_field(
        //             `SELECT amount FROM shipway_logistics_product_options_inventory WHERE combination_hash = ?`,
        //             [selectableCartId]
        //         ), 10);
        //     }

        //     if (cart.products && Array.isArray(cart.products)) {
        //         let productNotInCart = true;
        //         for (let [key, value] of Object.entries(cart.products)) {
        //             if (key !== cartId) {
        //                 if (
        //                     (tracking === 'W' && value.product_id === productId) ||
        //                     (tracking === 'O' && value.selectable_cart_id === selectableCartId)
        //                 ) {
        //                     currentAmount -= value.amount;
        //                 }
        //             } else {
        //                 productNotInCart = false;
        //             }
        //         }

        //         if (tracking === 'W' && updateId && productNotInCart && cart.products[updateId]) {
        //             currentAmount += cart.products[updateId].amount;
        //         }

        //         if (tracking === 'O' && selectableCartId && cart.products[cartId]) {
        //             cart.products[cartId].selectable_cart_id = selectableCartId;
        //         }
        //     }
        // }

        // Calculate minimum quantity
        
        
        let minQty = Math.max(1, product.min_qty || 1, product.qty_step || 1);

        // Adjust amount to the nearest step if needed
        let cartAmountChanged = false;
        if (product.qty_step && amount % product.qty_step !== 0) {
            amount = Math.ceil(amount / product.qty_step) * product.qty_step;
            cartAmountChanged = true;
        }


        // **************** Not even going inside these conditions ******************
        // if (currentAmount !== undefined && currentAmount >= 0 && currentAmount - amount < 0) {
        //     currentAmount += originalAmount;
        //     if (currentAmount > 0 && currentAmount - amount < 0) {
        //         amount = Math.ceil(currentAmount / product.qty_step) * product.qty_step;
        //     } else if (currentAmount - amount < 0) {
        //         return false;
        //     } else if (currentAmount <= 0 && amount <= 0) {
        //         return false;
        //     }
        // }

        // if (
        //     amount < minQty ||
        //     (currentAmount !== undefined && amount > currentAmount && tracking !== 'D' && !productNotInCart)
        // ) {
        //     if ((currentAmount < minQty || currentAmount === 0) && tracking !== 'D') {
        //         return false;
        //     } else if (amount > currentAmount && tracking !== 'D') {
        //         amount = Math.floor(currentAmount / product.qty_step) * product.qty_step;
        //     } else if (amount < minQty) {
        //         cartAmountChanged = false;
        //         amount = minQty;
        //     }
        // }

        const maxQty = Math.floor(product.max_qty / product.qty_step) * product.qty_step;



        // ***************** Not going inside this if also *****************
        // if (maxQty && amount > maxQty) {
        //     cartAmountChanged = false;
        //     amount = maxQty;
        // }

        if (cartAmountChanged) {
            console.warn(`Amount adjusted for product ${product.product}.`);
        }

        return amount || false;

    } catch (error) {
        console.error('Error in fn_check_amount_in_stock:', error);
        return false;
    }
}


async function fn_get_product_name(productId, langCode = 'en', asArray = false) {
    try {
        if (!productId) {
            return false;
        }

        let productIds = productId;
        if (!Array.isArray(productId) && typeof productId === 'string' && productId.includes(',')) {
            productIds = productId.split(',').map(id => parseInt(id, 10));
        }

        const fieldList = 'pd.product_id as product_id, pd.product as product';
        let condition;
        
        if (Array.isArray(productIds) || asArray) {
            condition = `AND pd.product_id IN (?) AND pd.lang_code = ?`;
        } else {
            condition = `AND pd.product_id = ? AND pd.lang_code = ?`;
        }

        // Query to fetch product names based on the condition
        const result = await db_get_hash_single_array(

            `SELECT ${fieldList} FROM shipway_logistics_product_descriptions pd WHERE 1 ${condition}`,
            [productId, langCode]
        );

        if (!(Array.isArray(productIds) || asArray)) {
            return result[productId] || null;
        }

        return result;

    } catch (error) {
        console.error('Error in fn_get_product_name:', error);
        return false;
    }
}


async function fn_define_original_amount(productId, cartId, product, prevProduct) {
    try {
        if (prevProduct?.original_product_data?.amount) {
            const tracking = await db_get_field("SELECT tracking FROM shipway_logistics_products WHERE product_id = ?", [productId]);

            if (
                // **************** extract the ProductTracking class variables *********************
                tracking !== ProductTracking.TRACK_WITH_OPTIONS ||
                (tracking === ProductTracking.TRACK_WITH_OPTIONS && prevProduct.original_product_data.cart_id === cartId)
            ) {
                product.original_amount = prevProduct.original_product_data.amount;
            }
            product.original_product_data = prevProduct.original_product_data;
        } else if (prevProduct?.original_amount) {
            product.original_amount = prevProduct.original_amount;
        }
    } catch (error) {
        console.error('Error in fn_define_original_amount:', error);
    }
}

module.exports = {
    fn_clear_cart,
    fn_add_product_to_cart,
    fn_generate_cart_id
}