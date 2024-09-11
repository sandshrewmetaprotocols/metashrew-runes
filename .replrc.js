var { encodeOutpointInput, decodeOutpointView } = require('./lib/outpoint');
var { OutpointResponse, Outpoint } = require('./lib/proto/metashrew-runes');


var payload = encodeOutpointInput('d1eb0b67ec52e71f5accb18d8fa64c3d3c74633a1cfecb8bf0e333eb391532b2', 1);
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
