var { encodeOutpointInput, decodeOutpointView } = require('./lib/outpoint');
var { OutpointResponse, Outpoint } = require('./lib/proto/metashrew-runes');


var payload = encodeOutpointInput('742f351581d1f63d9820f9d78ec3c44f70d5861cf2164c12e9503e04c78c1d46', 1);
var fn = async () => await (await fetch('http://localhost:8080', {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'metashrew_view',
    params: ['outpoint', payload, 'latest']
  }),
  headers: {
    'Content-Type': 'application/json'
  }
})).json();


var decode = async () => decodeOutpointView(Buffer.from((await fn()).result.substr(2), 'hex'));
