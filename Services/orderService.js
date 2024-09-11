const { fn_fill_auth } = require("./authService");
const { fn_clear_cart, fn_add_product_to_cart } = require("./cartService");
const { fn_place_order } = require("./placeOrderService");


async function dummy_order(params) {
    let data = {};
    let valid_params = true;
    let status = '';

    try {
        if (params.shipping_ids && !params.shipping_id) {
            params.shipping_id = params.shipping_ids;
        }

        let cart = {};
        cart = fn_clear_cart(cart,true);
        
        if (params.user_id) {
            // ***************** fn_get_user_info is never triggered *****************
            cart.user_data = await fn_get_user_info(params.user_id);
        } else if (params.user_data) {
            cart.user_data = params.user_data;
        }
        
        cart.total = '1';
        // console.log(cart);
        // return {status: 'Order Created', data: {order_id: 12345}};

        if (!params.user_id && !params.user_data) {
            data.message = `Required field missing: user_id/user_data`;
            valid_params = false;
        } else if (!params.payment_id) {
            data.message = `Required field missing: payment_id`;
            valid_params = false;
        }

        if (!params.shipping_id) {
            data.message = `Required field missing: shipping_id`;
            valid_params = false;
        }

        if (valid_params) {
            cart.payment_id = params.payment_id;

            let customer_auth = await fn_fill_auth(cart.user_data);

            await fn_add_product_to_cart(params.products, cart, customer_auth);

            // ****************** Not going inside this **************************
            // if (cart.product_groups && params.shipping_id) {
            //     cart.product_groups.forEach((group, key) => {
            //         group.shippings.forEach((shipping, shipping_id) => {
            //             if (params.shipping_id == shipping.shipping_id) {
            //                 cart.chosen_shipping[key] = shipping_id;
            //                 return;
            //             }
            //         });
            //     });
            // }

            cart.order_source = 'dummy order';
            cart.calculate_shipping = true;

            if(!cart.shipping_failed || !params.shipping_id){
                // await fn_update_payment_surcharge(cart, customer_auth); ************************ Not in use for dummy_orders **********************
                let order_id = await fn_place_order(cart, customer_auth);

                if (order_id) {
                    status = 'Order Created';
                    data = { order_id };
                }
            }
        }
    } catch (error) {
        status = 'Error';
        data = { message: error.message };
    }

    return { status, data };
}

module.exports = { dummy_order }