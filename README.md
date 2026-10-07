# Qkeep: Quantus (QTC) web wallet and Chrome extension

Qkeep is a non-custodial wallet for Quantus (QTC). Your keys stay on your device, every transfer is signed there with post-quantum ML-DSA signatures, and nothing secret is ever sent to a server.

- Web wallet: https://wallet.qkeep.app
- Chrome extension: https://chromewebstore.google.com/detail/qkeep-wallet-for-quantus/jbnhafgbblfhpkbipihplgcgdebkdeef
- Website and guides: https://qkeep.app
- Help: https://wallet.qkeep.app/help/
- Privacy policy: https://wallet.qkeep.app/privacy/
- Contact: hello@qkeep.app, X [@Qkeep_app](https://x.com/Qkeep_app)

## Features

- Send and receive QTC, with QR scan to fill in the recipient.
- Several 24-word seeds and many accounts in one wallet; restoring a seed finds the accounts it holds. Imported private keys are supported and can be backed up behind your password.
- Private sends from Encrypted Accounts, with the zero-knowledge proof built on your device.
- Extra privacy mode (opt-in): Encrypted Accounts are checked on your device from the full public feed instead of asking our server about your address. Even in normal mode, spent checks use padded buckets with decoys and proof requests carry no address.
- Device unlock with Face ID or Touch ID on supported devices.
- Live QTC price and transfer tracking until finality.
- English and Simplified Chinese.

## Security model

- The wallet is encrypted with your password (PBKDF2 and AES-GCM) and stored in your browser's storage. The seed and private keys never leave your device.
- Signing runs in a separate worker on your device. Our relay never receives secrets: it sees addresses for balance and history lookups, fee estimate requests, signed transactions to broadcast and connection metadata such as your IP address. See the privacy policy for the full list.
- Releases are verifiable: this repository publishes the SHA-256 list of every file the web wallet and the Chrome extension ship, so you can check that what you run is exactly what was published. See below.
- The source code is not public. Verification proves that everyone receives the same published bytes, not that the code is safe.

Built by the [lux8.net](https://lux8.net) team, who also run the [qtcscan.com](https://qtcscan.com) explorer. Not affiliated with or operated by the Quantus Network project.

## Release verification

This public repository contains checksums and a verifier, not the wallet source. Obtain this repository through GitHub independently of the wallet site. Use Node.js 20 or newer. No dependencies or wallet recovery phrase are needed.

```
node verify.mjs https://wallet.qkeep.app
node verify.mjs --extension /path/to/downloaded-store.zip
node verify.mjs --extension /path/to/unpacked-extension
node verify.mjs --version 1.66.0 https://wallet.qkeep.app
```

Exit 0 means all listed files matched; exit 1 means verification failed. A release must exist in this copy of the repository: update your copy to verify a newer release. An explicit version detects an older release being served. Automatic version detection alone does not prevent rollback to another published release.

Each version has web and store-extension SHA256SUMS lists, their SHA-256 release hashes, and the store ZIP hash. Later releases also include the development unpacked-extension list. ZIP checks require the exact published ZIP. Repacked ZIPs fail even when their files match; unpack them to compare content instead. Directory checks reject unexpected files except Chrome's added `_metadata/` directory. Chrome or a store may rewrite manifest.json or another file during packaging; such a change fails verification and is not silently ignored. Compare the published store ZIP or investigate the difference before trusting an installed copy.

The two generated files `release.json` and `release/SHA256SUMS` are excluded from their own checksum list to avoid a circular hash. For releases with those files, the verifier checks their exact bytes separately against the trusted version record and list here. v1.66.0 predates these metadata files and is recorded unchanged. All other web files and ZIP content files are listed, including scripts, styles, WASM and legal notices. A web server cannot be enumerated by this tool: unlisted server files, HTTP headers, API responses and server configuration are outside this check. ZIP and directory contents are enumerated.

This checks that the downloaded files match the published bytes, so users comparing the same release can detect different content. It does not prove the code is safe: the source is closed. It does not prove that the operator's published release is trustworthy. A compromised GitHub account or modified local verifier/checksum copy can defeat this check. The release header and on-screen short hash are convenient identifiers, not independent security guarantees.

A one-time check does not protect later visits or service worker updates. This verifier fetches files directly over HTTP, outside the browser cache; it cannot attest which cached files an existing browser tab is executing. Repeat verification after updates. It never accesses a vault, signs a transfer or broadcasts a transaction.

The verifier is MIT licensed; see LICENSE. Wallet licensing is separate.
