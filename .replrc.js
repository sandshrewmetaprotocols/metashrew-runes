var { encodeOutpointInput, decodeOutpointView } = require('./lib/outpoint');
var { OutpointResponse, Outpoint } = require('./lib/proto/metashrew-runes');
var { decodeRunesResponse, encodeBlockHeightInput } = require('./lib/src.ts/outpoint');



var payload = encodeOutpointInput('9a8df48236cc80c65ec398e364bba99926649261d1f9828d8c6e5aab7e26e7c7', 1);
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




var getRunes = async (height) => {
  const payload = encodeBlockHeightInput(height);
  console.log("Encoded payload:", payload);
  const response = await fetch('http://localhost:8080', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'metashrew_view',
      params: ['runesbyheight', payload, 'latest']
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const result = await response.json();
  const decodedResponse = decodeRunesResponse(result.result);
  if (decodedResponse.runes.length === 0) {
    console.log(`No runes found for block height ${height}`);
  } else {
    console.log(`Found ${decodedResponse.runes.length} rune(s) for block height ${height}`);
  }
  console.log(decodedResponse);
};


async function logRunes(height) {
  try {
    const blockRunes = []
    console.log(`Fetching runes for block height ${height}...`);
    const result = await getRunes(height);
  } catch (error) {
    console.error('Error fetching runes:', error);
  }
}
