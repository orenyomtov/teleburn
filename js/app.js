let teleburnedNft
let connectedAddress

async function connectWallet() {
    const addresses = await ethereum.request({ method: 'eth_requestAccounts' });
    const selectedAddress = addresses?.[0]
    if (selectedAddress) {
        walletAddressConnected(selectedAddress)
    }
}

async function sha256Hash(string) {
    const utf8 = new TextEncoder().encode(string);
    return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((bytes) => bytes.toString(16).padStart(2, '0'))
            .join('');
        return hashHex;
    });
}

async function walletAddressConnected(address) {
    connectedAddress = address
    const nftsContainer = document.getElementById('nftsContainer')
    nftsContainer.style.display = 'revert'
    document.getElementById('walletConnect').style = 'display: none !important'

    const nfts = (await fetch(`https://zapper.xyz/z/v2/nft/user/tokens?userAddress=${address}&limit=100`)
        .then(x => x.json())).items.map(x => x.token)
        .filter(x => x?.collection?.nftStandard == 'erc721')

    nftsContainer.innerHTML = ''
    document.getElementById('choose').style.display = 'revert'

    for (let nft of nfts) {
        nft = {
            name: nft.name,
            collection: nft.collection,
            tokenId: nft.tokenId,
            imageUrl: nft?.medias?.[0]?.originalUrl?.replace(/^ipfs:\/\//, 'https://cloudflare-ipfs.com/ipfs/') || 'https://goerli.etherscan.io/images/main/nft-placeholder.svg',
        }
        const nftElement = document.createElement('a')
        nftElement.className = `card card-tertiary w-100 fmxw-300`
        nftElement.innerHTML = `
                    <div class="card-header text-center">
                        <span>${nft.name}</span>
                    </div>
                    <div class="card-body" style="padding: 6px 7px 7px 7px">
                        <a href="https://opensea.io/assets/${nft.collection.network}/${nft.collection.address}/${nft.tokenId}" target="_blank" style="">
                            <img src="${nft.imageUrl}" style="width: 100%">
                        </a>
                        <button class="btn btn-block btn-primary mt-2" onclick='teleburn(${JSON.stringify(nft)})'>Teleburn</button>
                    </div>`
        nftsContainer.appendChild(nftElement)
    }
}

// https://github.com/casey/ord/blob/5bfb1bab7bd4e85866574b4c80a6d4b848b8a519/src/subcommand/teleburn.rs#L39
async function generateTeleburnAddress(inscriptionId) {
    const [txHash, index] = inscriptionId.split('i')
    const inscriptionIdBytes = new Uint8Array([...Uint8Array.from(txHash.match(/.{1,2}/g).reverse().map(x => parseInt(`0x${x}`))), ...new Uint8Array(Uint32Array.from([parseInt(index)]).buffer)]);
    const hashBuffer = await crypto.subtle.digest('SHA-256', inscriptionIdBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
    return `0x${hashHex.substr(0, 40)}`;
}

async function inscriptionIdChanged(inscriptionId) {
    if (await fetch(`https://ordinals.com/inscription/${inscriptionId}`).then(x => x.status) == 200) {
        document.getElementById('inscriptionId').classList.remove('is-invalid')
        document.getElementById('btnSendTeleburnTx').disabled = false
        document.getElementById('inscriptionIframe').src = `https://ordinals.com/preview/${inscriptionId}`
        document.getElementById('inscriptionIframe').style.display = 'block'
        document.getElementById('teleburnAddress').value = await generateTeleburnAddress(inscriptionId)
    } else {
        document.getElementById('inscriptionId').classList.add('is-invalid')
        document.getElementById('inscriptionIframe').style.display = 'none'
        document.getElementById('btnSendTeleburnTx').disabled = true
    }
}

async function teleburn(nft) {
    teleburnedNft = nft
    document.getElementById('nftImage').src = nft.imageUrl
    document.getElementById('nftImage').alt = `Token ID ${nft.tokenId} from collection ${nft.collection.address}`
    document.getElementById('nftImage').title = document.getElementById('nftImage').alt
    document.getElementById('nftName').textContent = nft.name

    document.getElementById('teleburnDialog').showModal()
}

async function sendTeleburnTx(inscriptionId) {
    const from = connectedAddress
    const to = document.getElementById('teleburnAddress').value
    const tokenId = teleburnedNft.tokenId
    const data = new TextEncoder().encode(`teleburned into inscription ${inscriptionId} using teleburn.wtf`)

    alert(`Just making sure that you understand that by confirming the following transaction, you are effectively burning your NFT on ${teleburnedNft.collection.network} and will no longer own it`)

    await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
            from,
            to: teleburnedNft.collection.address,
            // https://pkg.go.dev/github.com/ChainSafe/ChainBridge/bindings/IERC721Metadata#IERC721MetadataSession.SafeTransferFrom0
            data: "0xb88d4fde" + ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'uint256', 'bytes'], [from, to, tokenId, data]).substr(2),
        }],
    })

    window.open(`https://twitter.com/intent/tweet?text=I+just+%40teleburned+${encodeURIComponent(teleburnedNft.name)}+into+an+ordinal+inscription&url=https%3A%2F%2Fteleburn.wtf`, "_blank")
}

async function main() {
    if (typeof window.ethereum === 'undefined') {
        console.log('MetaMask is not installed!')
        document.getElementById('title').textContent = 'Error'
        document.getElementsByClassName('card-body')[0].innerHTML = '<a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank">MetaMask</a> is not installed'
        return
    }

    if (ethereum.selectedAddress) {
        await walletAddressConnected(ethereum.selectedAddress)
    }

    ethereum.on('accountsChanged', function () {
        walletAddressConnected(ethereum.selectedAddress)
    });
}

main()

const currDate = new Date()
const hoursMin = currDate.getHours().toString().padStart(2, '0') + ':' + currDate.getMinutes().toString().padStart(2, '0')
document.getElementById('time').textContent = hoursMin


