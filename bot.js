const ethers = require('ethers');

// const addresses = {
//   WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
//   factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
//   router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
//   recipient: 'recipient of the profit here'
// }

//First address of this mnemonic must have enough BNB to pay for tx fess
// let mnemonic = 'your mnemonic here, to send';

// const provider = new ethers.providers.WebSocketProvider('Ankr websocket url to mainnet');
// const wallet = ethers.Wallet.fromMnemonic(mnemonic);
// const account = wallet.connect(provider);

function getFactory(addresses, account) {
    return new ethers.Contract(
        addresses.factory,
        ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'],
        account
    );
}

function getRouter(addresses, account) {
    return new ethers.Contract(
        addresses.router,
        [
            'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
            'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ],
        account);
}

function getWbnb(addresses, account) {
    return new ethers.Contract(
        addresses.WBNB,
        [
            'function approve(address spender, uint amount) public returns(bool)',
        ],
        account);
}

async function start(wbnb, router, amount) {
    const tx = await wbnb.approve(
        router.address,
        amount
    );
    const receipt = await tx.wait();
    console.log('Transaction receipt');
    console.log(receipt);
}

function handlePairCreated(factory, addresses, router) {
    factory.on('PairCreated', async (token0, token1, pairAddress) => {
           console.log(`
       New pair detected
       =================
       token0: ${token0}
       token1: ${token1}
       pairAddress: ${pairAddress}
        `);

        //The quote currency needs to be WBNB (we will pay with WBNB)
        let tokenIn, tokenOut;
        if (token0 === addresses.WBNB) {
            tokenIn = token0;
            tokenOut = token1;
        }

        if (token1 === addresses.WBNB) {
            tokenIn = token1;
            tokenOut = token0;
        }

        //The quote currency is not WBNB
        if (typeof tokenIn === 'undefined') {
            return;
        }

        //We buy for 0.1 BNB of the new token
        //ethers was originally created for Ethereum, both also work for BSC
        //'ether' === 'bnb' on BSC
        const amountIn = ethers.utils.parseUnits('0.1', 'ether');
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = amounts[1].sub(amounts[1].div(10));
        console.log(`
          Buying new token
          =================
          tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
          tokenOut: ${amounOutMin.toString()} ${tokenOut}
        `);
        const tx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            [tokenIn, tokenOut],
            addresses.recipient,
            Date.now() + 1000 * 60 * 10 //10 minutes
        );
        const receipt = await tx.wait();
        console.log('Transaction receipt');
        console.log(receipt);
    });
}

function buildAddressData(recipient) {
    return {
        WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        recipient: recipient
    };
}

function buildProviderData(url) {
    return new ethers.providers.WebSocketProvider(url);
}

function buildWalletData(mnemonic) {
    return ethers.Wallet.fromMnemonic(mnemonic);
}

async function init(request) {
    console.log(request.body);
    if (request.body) {
        const addresses = buildAddressData(request.body.recipient);
        const provider = buildProviderData(request.body.provider);
        const wallet = buildWalletData(request.body.mnemonic);
        const amount = request.body.amount;
        const gas = request.body.gas;
        const account = wallet.connect(provider);

        const factory = getFactory(addresses, account);
        const router = getRouter(addresses, account);
        const wbnb = getWbnb(addresses, account);

        handlePairCreated(factory, addresses, router);

        let receipt = await start(wbnb, router, amount);
        console.log(receipt);
    }
}

module.exports = {
    init: init
}