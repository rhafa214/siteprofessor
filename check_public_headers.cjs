const https = require('https');

https.get('https://ais-dev-wsi6ctalyloci7northzfc-557047560215.us-east1.run.app/addon', (res) => {
  console.log('Headers from public URL:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
