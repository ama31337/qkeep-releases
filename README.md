# Qkeep release verification

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
