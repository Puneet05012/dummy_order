const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({
    host: 'localhost', 
    port: 6379, 
});

const redis_get = promisify(client.get).bind(client);
const redis_set = promisify(client.set).bind(client);
const redis_expire = promisify(client.expire).bind(client);

module.exports = {
    redis_get,
    redis_set,
    redis_expire,
    client
};