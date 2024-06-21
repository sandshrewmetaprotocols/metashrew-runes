# metashrew-bonds

Indexer backend for the SUBFROST vault. This indexer is queried by the SUBFROST federation in its consensus routine. The index provides view functions which produce the list of payments which must be included in response to incoming payments of BTC or RUNIC•BTC•NOTE/RUNIC•BTC•BOND, as they occur on the runes metaprotocol or any supported subprotocol imported by the index.

## Usage

To build the index:

```sh
git clone https://github.com/subfrost/metashrew-bonds
cd metashrew-bonds
yarn build
metashrew --db-dir ~/.metashrew-bonds --network bitcoin --daemon-dir ~/.bitcoind --indexer build/release.wasm
```

To start the view layer:

```sh
export PROGRAM_PATH=$HOME/metashrew-bonds/build/release.wasm
export DB_LOCATION=$HOME/.metashrew-bonds/bitcoin
export PORT=8080
metashrew-view
```

## Behavior

The exchange of BTC for RUNIC•BTC•NOTE is meant to be a simple in its mechanic: wrapped BTC is provided as runes in response to an incoming transfer of BTC, once 6 confirmations are reached for that transfer.

The inverse operation also works, with the additional feature where subprotocol indexers can be included and run in parallel for all subprotocols honored by the SUBFROST federation. In this way, it becomes possible to redeem notes as they exist on subprotocols to exchange value back to BTC currency, such that they may even be exchanged for their top level runic representation.

Transactions to wrap and unwrap incur a protocol fee which is enforced by the federation. Protocol fees are public and represented in an additional rune as a perpetual bond: RUNIC•BTC•BOND.

Bonds can be exchanged for BTC directly via SUBFROST at a rate proportional to the amount of unpaid dividends tracked by this index. The exchange rate of bonds follows suit with structures used on other networks as part of a standard yield strategy, where the circulating supply of bonds is valued in proportion to unpaid protocol fees accumulated.

Bonds can only be issued by the federation and thus are strictly available on the secondary market. This indexer drives the decentralized SUBFROST system, and honors transfers of bonds on runes or any subprotocol back to BTC.

## Author

Subtoshi Bondomoto


## License

MIT
