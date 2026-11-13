const https = require('https');

exports.handler = async function(event) {
  // Handle preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { action, params } = JSON.parse(event.body);
    const API_KEY = process.env.RAJAONGKIR_KEY;

    // Tentukan endpoint berdasarkan action
    let path = '';
    let postData = '';

    if (action === 'city') {
      path = '/starter/city';
      if (params && params.id) path += '?id=' + params.id;
    } else if (action === 'cost') {
      path = '/starter/cost';
      postData = `origin=${params.origin}&destination=${params.destination}&weight=${params.weight || 1000}&courier=${params.courier}`;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.rajaongkir.com',
        path,
        method: action === 'cost' ? 'POST' : 'GET',
        headers: {
          'key': API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: result
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
