// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
// exported by `circomkit contract sha256_32`
import {Groth16Verifier} from "../build/sha256_32/groth16_verifier.sol";

contract VerifierTest is Test {
    Groth16Verifier verifier;
    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;
    /// The bytes of the digest, which are the outputs of the circuit
    uint256[32] pubSignals;

    /// Reads the proof & public signals of `circomkit prove sha256_32`, which uses `inputs/sha256_32.json`.
    function setUp() public {
        verifier = new Groth16Verifier();

        string memory proof = vm.readFile("build/sha256_32/default/groth16_proof.json");
        pA = [vm.parseJsonUint(proof, ".pi_a[0]"), vm.parseJsonUint(proof, ".pi_a[1]")];
        // the contract takes the coordinates of `pi_b` in reverse order
        pB = [
            [vm.parseJsonUint(proof, ".pi_b[0][1]"), vm.parseJsonUint(proof, ".pi_b[0][0]")],
            [vm.parseJsonUint(proof, ".pi_b[1][1]"), vm.parseJsonUint(proof, ".pi_b[1][0]")]
        ];
        pC = [vm.parseJsonUint(proof, ".pi_c[0]"), vm.parseJsonUint(proof, ".pi_c[1]")];

        uint256[] memory pubs = vm.parseJsonUintArray(vm.readFile("build/sha256_32/default/public.json"), "$");
        for (uint256 i = 0; i < 32; i++) {
            pubSignals[i] = pubs[i];
        }
    }

    function test_Verify() public view {
        assertTrue(verifier.verifyProof(pA, pB, pC, pubSignals));
    }

    /// The circuit computes the same digest as Solidity's `sha256`.
    function test_Digest() public view {
        uint256[] memory preimage = vm.parseJsonUintArray(vm.readFile("inputs/sha256_32.json"), ".in");
        bytes memory data = new bytes(preimage.length);
        for (uint256 i = 0; i < preimage.length; i++) {
            data[i] = bytes1(uint8(preimage[i]));
        }
        bytes32 digest = sha256(data);
        for (uint256 i = 0; i < 32; i++) {
            assertEq(pubSignals[i], uint8(digest[i]));
        }
    }

    function test_RejectAnotherDigest() public view {
        uint256[32] memory other = pubSignals;
        other[0] ^= 1;
        assertFalse(verifier.verifyProof(pA, pB, pC, other));
    }
}
