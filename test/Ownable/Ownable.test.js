const { shouldBehaveLikeOwnable } = require('./Ownable.behavior');
const utils = require('tn-truffle-test-utils')

const Sale = artifacts.require('./LivenSale');

contract('Ownable', function ([_, owner, ...otherAccounts]) {
  beforeEach(async function () {
    purchaser = otherAccounts[1]
    this.ownable = await utils.deploy(Sale, owner, { from: owner } )
  });

  shouldBehaveLikeOwnable(owner, otherAccounts);
});
