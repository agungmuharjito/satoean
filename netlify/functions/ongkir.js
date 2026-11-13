const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { action, params } = JSON.parse(event.body);
    const KEY = process.env.BINDERBYTE_KEY;
    const BASE = 'https://api.binderbyte.com/v1';

    let result;

    if (action === 'province') {
      result = await httpsGet(`${BASE}/wilayah/provinsi?api_key=${KEY}`);

    } else if (action === 'city') {
      result = await httpsGet(`${BASE}/wilayah/kabupaten?api_key=${KEY}&id_provinsi=${params.province_id}`);

    } else if (action === 'search') {
      // Cari kota berdasarkan keyword - ambil semua kota dari semua provinsi lalu filter
      const provRes = await httpsGet(`${BASE}/wilayah/provinsi?api_key=${KEY}`);
      const provData = JSON.parse(provRes);
      if (provData.code != 200) {
        return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 500 }) };
      }

      const keyword = (params.keyword || '').toLowerCase();
      
      // Filter provinsi yang cocok dulu untuk batasi request
      const matchedProvs = provData.value.filter(p => 
        p.name.toLowerCase().includes(keyword)
      );
      
      // Juga ambil semua provinsi tapi filter kotanya
      const allProvs = provData.value;
      
      // Ambil kota dari semua provinsi secara parallel tapi batasi
      const cityPromises = allProvs.slice(0, 10).map(p =>
        httpsGet(`${BASE}/wilayah/kabupaten?api_key=${KEY}&id_provinsi=${p.id}`)
          .then(r => {
            const d = JSON.parse(r);
            return (d.code == 200 && d.value) 
              ? d.value
                  .filter(c => c.name.toLowerCase().includes(keyword))
                  .map(c => ({ id: c.id, name: c.name, province: p.name }))
              : [];
          })
          .catch(() => [])
      );

      const results = (await Promise.all(cityPromises)).flat().slice(0, 15);
      result = JSON.stringify({ code: 200, value: results });

    } else if (action === 'allcity') {
      // Ambil semua kota dari semua provinsi untuk search
      const provRes = await httpsGet(`${BASE}/wilayah/provinsi?api_key=${KEY}`);
      const provData = JSON.parse(provRes);
      
      if (provData.code != 200) {
        return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 500, message: 'Gagal ambil provinsi' }) };
      }

      // Ambil kota dari setiap provinsi (parallel)
      const cityPromises = provData.value.map(p =>
        httpsGet(`${BASE}/wilayah/kabupaten?api_key=${KEY}&id_provinsi=${p.id}`)
          .then(r => {
            const d = JSON.parse(r);
            return (d.code == 200 && d.value) ? d.value.map(c => ({
              id: c.id,
              name: c.name,
              province: p.name,
              province_id: p.id
            })) : [];
          })
          .catch(() => [])
      );

      const allArrays = await Promise.all(cityPromises);
      const allCities = allArrays.flat();

      result = JSON.stringify({ code: 200, value: allCities });

    } else if (action === 'cost') {
      result = await httpsGet(
        `${BASE}/cek_ongkir?api_key=${KEY}&kurir=${params.courier}&berat=${params.weight || 1000}&asal=${params.origin}&tujuan=${params.destination}`
      );

    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
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
