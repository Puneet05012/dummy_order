const { config } = require("../config/config");


async function fn_fill_auth(user_data = {}, original_auth = {}, act_as_user = false, area = 'C') {
    try {
        // Get active user groups based on user data and area
        // ***************** fn_define_userggroups is returning a empty array ***********************
        // const active_usergroups = await fn_define_usergroups(user_data, area);
        const active_usergroups = {};

        // Get the user's IP address
        const ip = await fn_get_ip();

        // Construct the auth object
        const auth = {
            area: !(await fn_check_user_type_admin_area(user_data)) ? 'C' : 'A',
            user_id: user_data.user_id || 0,
            // ************* _SESSION is now stored in config ****************
            master_user_id: config.SESSION.auth.user_id || 0,
            user_type: user_data.user_type || 'C',
            tax_exempt: user_data.tax_exempt || 'N',
            last_login: user_data.last_login || 0,
            order_ids: original_auth.order_ids || [],
            password_change_timestamp: user_data.password_change_timestamp || 0,
            company_id: user_data.company_id || 0,
            is_root: user_data.is_root || 'N',
            usergroup_ids: active_usergroups,
            act_as_user: act_as_user,
            this_login: original_auth.this_login || Date.now(),
            // ************* _SERVER is now stored in config ****************
            referer: original_auth.referer || config.SERVER.HTTP_REFERER || '',
            ip: ip.host
        };

        // Return the filled auth object
        return auth;

    } catch (error) {
        console.error('Error in fn_fill_auth:', error.message);
        throw error;
    }
}

function fn_get_ip(returnInt = false) {
    const fields = [
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_FORWARDED',
        'HTTP_FORWARDED_FOR',
        'HTTP_FORWARDED',
        'HTTP_FORWARDER_IP',
        'HTTP_X_COMING_FROM',
        'HTTP_COMING_FROM',
        'HTTP_CLIENT_IP',
        'HTTP_VIA',
        'HTTP_XROXY_CONNECTION',
        'HTTP_PROXY_CONNECTION'
    ];

    let forwardedIp = '';
    let matches = [];

    try {
        // ***************** THIS for loop is not executing ****************************
        // for (let field of fields) {
        //     // *************** Check for the $_SERVER in php *******************
        //     if (config.SERVER.field) { 
        //         matches = config.SERVER.field.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
        //         if (matches && matches[0] && matches[0] !== config.SERVER['REMOTE_ADDR']) {
        //             forwardedIp = matches[0];
        //             break;
        //         }
        //     }
        // }

        const ip = {
            host: forwardedIp,
            proxy: config.SERVER.REMOTE_ADDR 
        };


        // ************* This is never used ***************

        // if (returnInt) {
        //     ip.host = ip.host ? ip2long(ip.host) : 0;
        //     ip.proxy = ip.proxy ? ip2long(ip.proxy) : 0;
        // }


        if(!ip.host || !fn_is_inet_ip(ip.host,returnInt)){
            ip.host = ip.proxy;
            ip.proxy = returnInt ? 0 : '';
        }

        return ip;
    } catch (error) {
        console.error('Error retrieving IP:', error);
        return { host: '', proxy: '' };
    }
}

// function ip2long(ip) {
//     return ip.split('.').reduce((int, octet) => (int << 8) + parseInt(octet, 10), 0) >>> 0;
// }

function fn_check_user_type_admin_area(user_type = '') {
    try {
        if (typeof user_type === 'object' && user_type !== null) {
            user_type = user_type.user_type || '';
        }

        return user_type === 'A' || user_type === 'V';
    } catch (error) {
        console.error('Error in fn_check_user_type_admin_area:', error);
        return false;
    }
}

module.exports = {
    fn_fill_auth,
}