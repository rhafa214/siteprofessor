const https = require('https');

https.get('https://ais-pre-wsi6ctalyloci7northzfc-557047560215.us-east1.run.app/addon', (res) => {
  console.log('Headers from shared URL:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
