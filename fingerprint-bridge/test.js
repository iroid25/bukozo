const http = require('http');
function post(host, port, path, body) {
  return new Promise((res, rej) => {
    const s = JSON.stringify(body);
    const req = http.request(
      { host, port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) } },
      (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }
    );
    req.on('error', rej);
    req.end(s);
  });
}
async function run() {
  console.log('Capturing — place finger now...');
  const cap = await post('localhost', 8000, '/SGIFPCapture', { Timeout: 10000, Quality: 50 });
  console.log('Captured Q=' + cap.ImageQuality + ' ErrorCode=' + cap.ErrorCode);
  const tmpl = await post('127.0.0.1', 8001, '/template', { bmpBase64: cap.BMPBase64 });
  console.log('Template errorCode=' + tmpl.errorCode + ' size=' + tmpl.size + ' decoded=' + (tmpl.template ? Buffer.from(tmpl.template, 'base64').length : 0) + 'B');
  if (tmpl.template) {
    const match = await post('127.0.0.1', 8001, '/match', { template1: tmpl.template, template2: tmpl.template });
    console.log('SELF-MATCH errorCode=' + match.errorCode + ' score=' + match.score + ' matched=' + match.matched);
  }
}
run().catch(e => console.error('ERROR:', e.message));
