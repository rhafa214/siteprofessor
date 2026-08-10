const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate-lousa',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Response body:', data);
  });
});

req.write(JSON.stringify({}));
req.end();
