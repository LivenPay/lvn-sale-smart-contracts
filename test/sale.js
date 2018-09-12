const Sale = artifacts.require('Sale')
const utils = require('tn-truffle-test-utils')

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

let sale
let owner
let firstPurchase = 1000000000000000000

contract('Sale', (accounts) => {
  beforeEach(async () => {
    owner = accounts[0]
    purchaser = accounts[1]
    sale = await utils.deploy(Sale, owner, { from: owner } )
  })
  it('Sets the owner of the sale correctly', async () => {
    let saleOwner = await sale.owner.call()
    assert.equal(saleOwner, owner, "Owner is correctly set after deploy.")
  })
  it('Allows us to contribute ETH to the sale', async () => {
    await sale.sendTransaction({ value: firstPurchase, from: purchaser })
    const actualLiven = await sale.weiContributed.call(purchaser)
    assert.equal(actualLiven, firstPurchase)
  })
  it('Forwards proceeds immediately', async () => {
    const purchaseAmount = web3.toWei(1, 'ether')
    const proceedsAddress = await sale.proceedsAddress.call()
    const proceedsBalanceBefore = await web3.eth.getBalance(proceedsAddress)
    await sale.sendTransaction({ value: purchaseAmount, from: purchaser })
    const proceedsBalanceAfter = await web3.eth.getBalance(proceedsAddress)
    const saleBalance = await web3.eth.getBalance(sale.address)
    // The following test fails as a regular assert as number (see line below).
    proceedsBalanceAfter.should.be.bignumber.above(proceedsBalanceBefore);
    // assert.isAbove(proceedsBalanceBefore.toNumber(), proceedsBalanceAfter.toNumber(), "more ETH in proceeds address than before purchase.")
    assert.isAbove(proceedsBalanceAfter.toNumber(), purchaseAmount * 0.98, "most ETH from purchase in proceeds address.") // check that we got at least 98% (gas)
    assert.equal(saleBalance.toNumber(), 0, "no balance remains in sale contract.")
  })
  it('Allows the owner to stop the sale', async () => {
    await sale.endSale( { from: owner } )
    assert.isOk(await sale.saleEnded.call(), "Owner can end sale.")
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(1, 'ether'), from: accounts[1] }))
  })
  it('Prevents anyone but the owner to stop the sale', async () => {
    await utils.assertThrows(sale.endSale( { from: purchaser } ))
  })
  it('Prevents us from contributing less than 0.1 ETH', async () => {
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(0.099, 'ether'), from: accounts[1] }))
  })
  it('Prevents us from contributing more than 1000 ETH', async () => {
    const proceedsAddress = await sale.proceedsAddress.call()
    const ethBefore = await web3.eth.getBalance(purchaser)
    const proceedsBalanceBefore = await web3.eth.getBalance(proceedsAddress)
    await sale.sendTransaction({ value: web3.toWei(1001, 'ether'), from: purchaser })
    const actualContribution = await sale.weiContributed.call(purchaser)
    assert.equal(actualContribution.toNumber(), web3.toWei(1000, 'ether'), "ETH allocation of purchaser is maxed out.")
    const ethAfter = await web3.eth.getBalance(purchaser)
    assert.isAbove(ethBefore.toNumber(), (ethAfter.add(web3.toWei(1000, 'ether')).mul(0.99999)).toNumber(), "Purchaser's ETH balance is about 1000 ETH less after purchase.")
    const proceedsBalanceAfter = await web3.eth.getBalance(proceedsAddress)
    // The following test fails as a regular assert as number (see line below).
    proceedsBalanceAfter.should.be.bignumber.equal(proceedsBalanceBefore.add(web3.toWei(1000, 'ether')));
  })
  it('Throws at next transaction after contributing 1000 ETH', async () => {
    // Buy as much as possible
    const proceedsAddress = await sale.proceedsAddress.call()
    const ethBefore = await web3.eth.getBalance(purchaser)
    const proceedsBalanceBefore = await web3.eth.getBalance(proceedsAddress)
    await sale.sendTransaction({ value: web3.toWei(1000, 'ether'), from: purchaser })
    // Try to buy more
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(1, 'ether'), from: purchaser }))
  })
  it('Prevents us from contributing after the end time of the sale', async () => {
    const secondsToIncrease = (86400 * 7 * 6) + 86400 // six weeks and one day
    await utils.increaseTime(secondsToIncrease)
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(1, 'ether') }))
  })
  it('Allows us to extend the time limit of the sale', async () => {
    const secondsToIncrease = (86400 * 7 * 6) + 86400 // six weeks and one day
    const secondsToExtend = 86400 * 7 // one week
    await utils.increaseTime(secondsToIncrease)
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(1, 'ether') }))
    await sale.extendSale(secondsToExtend)
    await sale.sendTransaction({ value: web3.toWei(1, 'ether' )})
    await utils.increaseTime(secondsToIncrease) // end the sale again
    await utils.assertThrows(sale.sendTransaction({ value: web3.toWei(1, 'ether') }))
  })
  it('Does not allow a non-owner to extend the time limit of the sale', async () => {
    await utils.assertThrows(sale.extendSale(1, { from: accounts[1] }))
  })
})