// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FeeManager}       from "../src/FeeManager.sol";
import {PaymentCore}      from "../src/PaymentCore.sol";

/// @notice Deploy FeeManager then PaymentCore.
///
/// Required env vars:
///   DEPLOYER_PK  — private key of the deployer / initial admin
///   TREASURY     — address that receives fee proceeds
///
/// Optional env vars (if left unset, the script skips token/merchant setup):
///   USDC_ADDRESS — whitelisted stablecoin
///   USDT_ADDRESS — whitelisted stablecoin
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC_URL \
///     --broadcast \
///     --verify \
///     -vvvv
contract Deploy is Script {
    function run() external {
        address admin    = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY");

        vm.startBroadcast(vm.envUint("DEPLOYER_PK"));

        // 1. FeeManager (default tiered fee model)
        FeeManager fm = new FeeManager(admin);
        console2.log("FeeManager deployed:", address(fm));

        // 2. PaymentCore
        PaymentCore core = new PaymentCore(admin, treasury, address(fm));
        console2.log("PaymentCore deployed:", address(core));

        // 3. Optional: whitelist stablecoins
        _tryWhitelist(core, "USDC_ADDRESS");
        _tryWhitelist(core, "USDT_ADDRESS");

        vm.stopBroadcast();

        console2.log("--- Deployment summary ---");
        console2.log("FeeManager :", address(fm));
        console2.log("PaymentCore:", address(core));
        console2.log("Treasury   :", treasury);
        console2.log("Admin      :", admin);
    }

    function _tryWhitelist(PaymentCore core, string memory envKey) internal {
        try vm.envAddress(envKey) returns (address token) {
            if (token != address(0)) {
                core.addSupportedToken(token);
                console2.log("Whitelisted token:", token);
            }
        } catch {}
    }
}
