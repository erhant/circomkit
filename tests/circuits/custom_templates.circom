pragma circom 2.1.0;
pragma custom_templates;

template custom Example() {
   // custom template's code
}

template MyTest() {
  signal input in;
  signal output out;

  component example = Example(); // instantiation of the custom template
  out <== in * 2;
}

