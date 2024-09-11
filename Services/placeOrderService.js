const { config } = require("../config/config");
const { db_query } = require("../Model/mysql");



async function fn_place_order(cart, auth, action = '', issuer_id = null, parent_order_id = 0) {
    try {
        cart.invoice_number = cart.invoice_number || '';
        cart.invoice_number_prefix = cart.invoice_number_prefix || 'N';

        if (cart.parent_order_id && parent_order_id === 0) {
            parent_order_id = parseInt(cart.parent_order_id, 10);
        }

        const allow = await fn_allow_place_order(cart, auth, parent_order_id);

        if (!allow) {
            throw new Error('Order was not placed.');
        }

        if (allow && !fn_cart_is_empty(cart, false)) {
            cart.parent_order_id = parent_order_id;

            if (cart.payment_info && cart.payment_info.card_number) {
                cart.payment_info.card_number = cart.payment_info.card_number.replace(/[\s-]/g, '');
            }   

            let order_id, order_status;
            if (!cart.order_id) {
                cart.user_id = auth.user_id;
                cart.tax_exempt = auth.tax_exempt;
                cart.issuer_id = issuer_id;
                [order_id, order_status] = await fn_update_order(cart);
            } else {
                [order_id, order_status] = await fn_update_order(cart, cart.order_id);
            }

            if (order_id) {
                if (!parent_order_id) {
                    const condition = fn_user_session_products_condition();
                    await db_query('UPDATE shipway_logistics_user_session_products SET order_id = ? WHERE ' + condition, [order_id]);
                }

                if (!auth.user_id) {
                    auth.order_ids = auth.order_ids || [];
                    auth.order_ids.push(order_id);
                }

                if (parseFloat(cart.total) === 0) {
                    action = 'save';
                }

                if (cart.total_tip_received) {
                    const tip_hash = { total_tip_received: cart.total_tip_received };
                    // ********** REQUEST is used here in php instead of cart ************
                    cart.order_hash = JSON.stringify(tip_hash);
                }

                
                let is_processor_script = false;


                // ********************* Not going inside this function *******************
                // if (action !== 'save') {
                //     [is_processor_script] = await fn_check_processor_script(cart.payment_id, true);
                // }

                if (!is_processor_script && order_status === config.STATUS_INCOMPLETED_ORDER) {
                    if (cart.create_return === '1') {
                        order_status = 'R';
                    } else if (cart.sync_fullfiled_status === 1) {
                        order_status = 'S';
                    } else {
                        order_status = 'O';
                    }
                }

                const short_order_data = await fn_get_order_short_info(order_id);

                if (!cart.return) {
                    await fn_change_order_status(
                        order_id,
                        order_status,
                        short_order_data.status,
                        is_processor_script || order_status === STATUS_PARENT_ORDER
                            ? fn_get_notification_rules({}, true)
                            : fn_get_notification_rules({}),
                        true
                    );
                }

                cart.processed_order_id = [order_id];

                if (!parent_order_id && cart.product_groups.length > 1) {
                    const child_orders = await fn_place_suborders(order_id, cart, auth, action, issuer_id);
                    cart.processed_order_id = [order_id, ...child_orders];
                }

                if (orderId && cart.return === '1') {
                    await handle_return_order(cart, orderId, orderStatus);
                } 
                
                await handle_invoice_generation(orderId, cart);

                return [order_id, action !== 'save'];
            }
        }

        return [false, false];
    } catch (error) {
        console.error('Error placing order:', error.message);
        return [false, false];
    }

}


function fn_allow_place_order(cart, auth = null, parent_order_id = null) {
    try {

        // Determine total based on the type
        const total = cart.total;

        // Check minimal amount only for parent order
        if (!parent_order_id) {
            cart.amount_failed = 0;
        }

        // Check for any failure flags in the cart
        if (cart.amount_failed || cart.shipping_failed || cart.company_shipping_failed) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in fn_allow_place_order:', error);
        return false;
    }
}

function fn_cart_is_empty(cart, check_excluded = true) {
    try {
        // Check if the cart's products array is empty
        let result = !cart.products || cart.products.length === 0;

        if (check_excluded && !result) {
            result = true;

            // Loop through the products to check exclusion conditions
            for (let product of cart.products) {
                if (!product.extra?.exclude_from_calculate && !product.extra?.parent) {
                    result = false;
                    break;
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Error in fn_cart_is_empty:', error);
        return true; // Assuming the cart is empty in case of an error
    }
}

function fn_user_session_products_condition(params = {}) {
    try {
        // Initialize parameters with defaults
        params = Object.assign({
            user_id: null,
            session_id: config.session_id, // ************** config ****************
            type: 'C',
            user_type: '',
            get_session_user_id: true,
        }, params);

        // Get user ID from session if not provided
        if (params.user_id === null && params.get_session_user_id) {
            if(config.SESSION.auth.user_id){
                params.user_id = config.SESSION.auth.user_id;
            } else {
                params.user_id = fn_get_session_data('cu_id');
            }
        }

        const conditions = {};

        if (params.user_id) {
            conditions.user_id = `user_id = ${params.user_id}`;
        }

        if (params.session_id) {
            conditions.session_id = `session_id = ${params.session_id}`;
        }

        if (params.type) {
            conditions.type = `type = ${params.type}`;
        }

        if (params.user_type) {
            conditions.user_type = `user_type ${params.user_type}`;
        }

        return Object.values(conditions).join(' AND ');
    } catch (error) {
        console.error('Error in fn_user_session_products_condition:', error);
        throw error; // Or handle the error as needed
    }
}

async function fn_get_order_short_info(order_id) {
    try {
        if (order_id) {
            const order = await db_get_row(
                "SELECT total, status, issuer_id, firstname, lastname, timestamp, is_parent_order FROM shipway_logistics_orders WHERE order_id = ?",
                [order_id]
            );

            return order;
        }

        return false; 
    } catch (error) {
        console.error(`Error retrieving order short info: ${error.message}`);
        throw error; 
    }
}

module.exports = {
    fn_place_order
}