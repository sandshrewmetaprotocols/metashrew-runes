# metashrew-runes

Implementation of [https://github.com/ordinals/ord](https://github.com/ordinals/ord) runestone.

This indexer can be run in metashrew to index the runes metaprotocol, and it surfaces 3 view functions that can be called from metashrew-view via a JSON-RPC call to read the state of the index.

## Usage

Running in docker:

Clone the metashrew repository from [https://github.com/sandshrewmetaprotocols/metashrew](https://github.com/sandshrewmetaprotocols/metashrew-runes)

Install the latest version of docker-ce.

Sync a Bitcoin node with the kylemanna/bitcoind docker image with ports 8332 and 8333 exposed (if you are targeting mainnet).

You must expose the volume you mount to /bitcoin/.bitcoin within the Bitcoin image. For this example we will assume the Bitcoin daemon directory is mounted to /home/ubuntu/bitcoind

Make a directory for the metashrew database. For this example we will say the directory should be /home/ubuntu/.metashrew

Clone and build this repository to a WASM binary:

```sh
git clone https://github.com/sandshrewmetaprotocols/metashrew-runes
bash -c 'cd metashrew-runes; yarn; yarn build'
```

Copy the WASM build to the metashrew database directory.

```sh
cp ~/metashrew-runes/build/debug.wasm ~/.metashrew/indexer.wasm
```

Create a metashrew/.env file with the following contents

```
METASHREW_DATA=/home/ubuntu/.metashrew
BITCOIN_DATA=/home/ubuntu/bitcoind
LOG_FILTERS=DEBUG
```

Now launch the docker containers with docker-compose and attach to the logs.

```sh
cd metashrew
docker-compose up -d && docker-compose logs --tail 50 -f
```

Now the index will sync and, on sync, you can make RPC calls to metashrew-view (by default, listening on port 8080).

Helper functions exist in the TypeScript sources included in this repository to encode JSON-RPC calls to metashrew-view.


## Author

Sandshrew Inc

## License

MIT
