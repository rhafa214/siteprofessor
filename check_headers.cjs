const http = require('http');

http.get('http://localhost:3000', (res) => {
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
