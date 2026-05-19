const https = require('https');

https.get('https://ais-dev-wsi6ctalyloci7northzfc-557047560215.us-east1.run.app/__cookie_check.html', (res) => {
  console.log('Headers from cookie_check:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
