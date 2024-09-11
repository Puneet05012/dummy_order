const express = require('express');
const { config } = require('../config/config');
const { fn_update_product } = require('../Services/productService');
const { dummy_order } = require('../Services/orderService');


const app = express();
const port = 7000;

app.use(express.json());

app.post('/create_dummy_order', async (req, res) => {
    try{
        const product_data = {
            product: 'Test Product Name',
            company_id: '123', 
            category_ids: [config.default_category_id],
            main_category: config.default_category_id,
            price: '9.00',
            status: 'A',
            product_code: 'TEST123',
            amount: 1,
            weight: 200,
            tax_ids: { '6': '6' }
        };
    
    
        const inserted_product_id = await fn_update_product(product_data);

        
        // return res.status(200).json({message: 'Ok Report', data: inserted_product_id});

        const products = {};
        products[inserted_product_id] = {
            ...product_data,
            amount: 1,
            discount: 0,
            tax_rate: 0,
            tax_title: ''
        };
    
        const order_data = {
            user_data: {
                b_address: 'Testing address1',
                b_address_2: 'Testing address2',
                b_city: 'Testing city',
                b_country: 'IN',
                b_firstname: 'Testing',
                b_lastname: 'Name',
                b_phone: '9999999999',
                b_state: 'Testing state',
                b_zipcode: '122018',
                company: '',
                s_address: 'Testing address1',
                s_address_2: 'Testing address2',
                s_city: 'Testing city',
                s_country: 'IN',
                s_firstname: 'Testing',
                s_lastname: 'Name',
                s_phone: '9999999999',
                s_state: 'Testing state',
                s_zipcode: '122018',
                email: 'xyz@ezyslips.com',
                customer_gst_number: ''
            },
            payment_id: 6,
            shipping_ids: '1',
            products: products
        };

        let shipping_cost = 0;
        let order = {
            total_price: '9.00'
        }

        config.vendor_order_id = `dummy_order_${new Date().getMinutes()}_${new Date().getSeconds()}`;
        config.stored_order_total = (order && order.total_price) ? order.total_price : 0;
        order.total = order.total_price;

        config.stored_shipping_cost = [[shipping_cost]];
        config.stored_shipping = [['Y']];
        config.subtotal_discount = 0;
        config.stored_subtotal_discount = 'Y';
        config.store_code = '0';

        config.stored_taxes = 'Y';
        config.taxes = { 6: 0 };

        config.order_weight = 0;

        config.vendor_order_date = new Date().toISOString().replace('T', ' ').replace('Z', '');

    
        const order_response = await dummy_order(order_data);
        
        if(order_response.status === 'Order Created'){
            res.status(200).json({ message: order_response.status, data: order_response.data });
        }
        else{
            res.status(500).json({ message: order_response.status, data: order_response.data });
        }

    } catch (error) {
        console.error('Error creating dummy order:', error);
        res.status(500).json({ message: 'An error occurred while creating the dummy order.' });
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});