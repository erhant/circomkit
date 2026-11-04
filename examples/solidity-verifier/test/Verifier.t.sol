// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
// exported by `circomkit contract multiplier_3`
import {Groth16Verifier} from "../build/multiplier_3/groth16_verifier.sol";

contract VerifierTest is Test {
    Groth16Verifier verifier;
    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;
    uint256[1] pubSignals;

    /// Reads the proof & public signals of `circomkit prove multiplier_3`, which uses the `default` input.
    function setUp() public {
        verifier = new Groth16Verifier();

        string memory proof = vm.readFile("build/multiplier_3/default/groth16_proof.json");
        pA = [vm.parseJsonUint(proof, ".pi_a[0]"), vm.parseJsonUint(proof, ".pi_a[1]")];
        // the contract takes the coordinates of `pi_b` in reverse order
        pB = [
            [vm.parseJsonUint(proof, ".pi_b[0][1]"), vm.parseJsonUint(proof, ".pi_b[0][0]")],
            [vm.parseJsonUint(proof, ".pi_b[1][1]"), vm.parseJsonUint(proof, ".pi_b[1][0]")]
        ];
        pC = [vm.parseJsonUint(proof, ".pi_c[0]"), vm.parseJsonUint(proof, ".pi_c[1]")];

        uint256[] memory pubs = vm.parseJsonUintArray(vm.readFile("build/multiplier_3/default/public.json"), "$");
        pubSignals = [pubs[0]];
    }

    function test_Verify() public view {
        // the public signal is the output, 2 * 4 * 10
        assertEq(pubSignals[0], 80);
        assertTrue(verifier.verifyProof(pA, pB, pC, pubSignals));
    }

    function test_RejectAnotherOutput() public view {
        assertFalse(verifier.verifyProof(pA, pB, pC, [uint256(81)]));
    }
}
