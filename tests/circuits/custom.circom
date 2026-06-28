pragma circom 2.1.0;
pragma custom_templates;

/// A custom template (gate) that acts as a multiplier.
/// Custom templates define R1CS-level gates using signal assignments.
template custom CustomMul() {
    signal input a;
    signal input b;
    signal output out;

    out <-- a * b;
}

template CustomMultiplier() {
    signal input in1;
    signal input in2;
    signal output out;

    out <== CustomMul()(in1, in2);
}
