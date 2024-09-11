const config = {}

config.default_category_id = '255';
config.default_company_id = 0;

config.mysql = {
    host: 'localhost',
    user: 'root',
    password: 'Shipwayongc',
    database: 'ezyslips_local',
    // protocol: 'tcp'
};

config.ORDER_MANAGEMENT = true;

config.dir = {
    payments: '/path/to/payments/', // Replace with your actual payments directory
    addons: '/path/to/addons/' // Replace with your actual addons directory
};

config.addons = {
    addon1: { status: 'A' },
    addon2: { status: 'D' },
};

config.CONTROLLER_STATUS_REDIRECT = 302;

config.ProductTracking = {
    TRACK_WITH_OPTIONS : 'O'
}

config.CART_PRIMARY_CURRENCY = 'INR';

config.SESSION = {
    auth : {
        user_id : '11919'
    }
}

config.session_id = '7ff1bf5f1e964e3e97de3ffae3af81a5_A';

config.STATUS_INCOMPLETED_ORDER = 'N';

config.SERVER = {
    HTTP_REFERER : 'https://localhost/ezyslips-new/merchant.php?dispatch=orders.manage&status=O&tab=new_orders&period=HM',
    REMOTE_ADDR : '172.18.0.1'
}

module.exports = { config }