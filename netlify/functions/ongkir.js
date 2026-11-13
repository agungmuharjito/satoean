const https = require('https');

exports.handler = async function(event) {
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
    const API_KEY = process.env.BINDERBYTE_KEY;

    let path = '';

    if (action === 'province') {
      path = '/v1/wilayah/provinsi?api_key=' + API_KEY;
    } else if (action === 'city') {
      path = '/v1/wilayah/kabupaten?api_key=' + API_KEY + '&id_provinsi=' + params.province_id;
    } else if (action === 'cost') {
      path = '/v1/cek_ongkir?api_key=' + API_KEY +
             '&kurir=' + params.courier +
             '&berat=' + (params.weight || 1000) +
             '&asal=' + params.origin +
             '&tujuan=' + params.destination;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.binderbyte.com',
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
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
