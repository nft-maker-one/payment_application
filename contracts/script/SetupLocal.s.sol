// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PaymentCore}      from "../src/PaymentCore.sol";
import {MockERC20}       from "../test/mocks/MockERC20.sol";

contract SetupLocal is Script {
    function run() external {
        address coreAddress = vm.envAddress("PAYMENT_CORE");
        PaymentCore core = PaymentCore(coreAddress);

        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));

        // 1. Deploy Mock USDC
        MockERC20 usdc = new MockERC20("Mock USDC", "USDC", 6);
        console2.log("Mock USDC deployed:", address(usdc));

        // 2. Deploy Mock USDT
        MockERC20 usdt = new MockERC20("Mock USDT", "USDT", 6);
        console2.log("Mock USDT deployed:", address(usdt));

        // 3. Whitelist tokens
        core.addSupportedToken(address(usdc));
        core.addSupportedToken(address(usdt));
        console2.log("Tokens whitelisted");

        // 4. Register a merchant (using Account 2 as merchant)
        address merchant = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        core.registerMerchant(merchant, "Test Merchant");
        console2.log("Merchant registered:", merchant);

        // 5. Mint some tokens to Account 0 (payer)
        address payer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        usdc.mint(payer, 1000 * 10**6);
        usdt.mint(payer, 1000 * 10**6);
        console2.log("Tokens minted to payer");

        vm.stopBroadcast();
    }
}
