pragma circom 2.2.0;

/// A simple template that uses signal tags.
/// The `maxbits` valued tag restricts the bit-width of inputs.
template BoundedAdd() {
    signal input {maxbits} a;
    signal input {maxbits} b;

    // Ensure inputs fit within their declared bit-width
    assert(a.maxbits <= 64);
    assert(b.maxbits <= 64);

    signal output out;
    out <== a + b;
}

/// Wrapper template that applies tags to untagged inputs.
/// This is needed because `component main` cannot have tagged inputs.
template BoundedAdd_wrapper(N) {
    signal input a;
    signal input b;

    signal {maxbits} a_tagged;
    signal {maxbits} b_tagged;

    a_tagged.maxbits = N;
    a_tagged <== a;

    b_tagged.maxbits = N;
    b_tagged <== b;

    signal output out <== BoundedAdd()(a_tagged, b_tagged);
}
