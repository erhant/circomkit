//! Tag-wrapper generation (issue #116).
//!
//! `component main` cannot have tagged inputs, so a template whose inputs carry
//! `{tag}` metadata can't be used directly as a circuit's main component. This
//! module generates a wrapper template with plain (untagged) inputs that
//! internally creates tagged intermediate signals, sets their tag values, and
//! forwards everything to the original template.
//!
//! Tag values are supplied via wrapper parameters — one parameter per distinct
//! tag name, applied to every input that carries it. Because the interface-only
//! parser cannot tell whether a tag is *valued*, every tag is treated as valued;
//! for non-valued tags the emitted `sig.tag = ...;` line can simply be removed.

use circomkit_parser::{CircomProgram, Signal, Template};

use crate::CodegenError;

/// Generate a `<Name>_wrapper` template for a template with tagged inputs.
///
/// Returns [`CodegenError::NoTaggedInputs`] if the template has no tagged
/// inputs (in which case no wrapper is needed).
pub fn generate_tag_wrapper(template: &Template) -> Result<String, CodegenError> {
    generate_tag_wrapper_with_suffix(template, "_wrapper")
}

/// Like [`generate_tag_wrapper`], but with a custom name suffix.
pub fn generate_tag_wrapper_with_suffix(
    template: &Template,
    suffix: &str,
) -> Result<String, CodegenError> {
    let inputs: Vec<&Signal> = template.inputs().collect();
    if !inputs.iter().any(|s| !s.tags.is_empty()) {
        return Err(CodegenError::NoTaggedInputs(template.name.clone()));
    }

    // Distinct tag names, in first-seen order — each becomes a wrapper parameter.
    let mut tag_params: Vec<String> = Vec::new();
    for s in &inputs {
        for tag in &s.tags {
            if !tag_params.contains(tag) {
                tag_params.push(tag.clone());
            }
        }
    }

    // Wrapper parameters: the original template's parameters, then tag params.
    let mut params = template.params.clone();
    for tag in &tag_params {
        if !params.contains(tag) {
            params.push(tag.clone());
        }
    }

    let inner_params = template.params.join(", ");
    let mut out = String::new();

    out.push_str(&format!(
        "template {}{}({}) {{\n",
        template.name,
        suffix,
        params.join(", ")
    ));

    // Plain (untagged) inputs mirroring the original template's inputs.
    for s in &inputs {
        out.push_str(&format!(
            "    signal input {}{};\n",
            s.name,
            dims_suffix(&s.dimensions)
        ));
    }
    out.push('\n');

    // Tagged intermediate signals, with tag values set and inputs connected.
    for s in &inputs {
        if s.tags.is_empty() {
            continue;
        }
        out.push_str(&format!(
            "    signal {{{}}} {}_tagged{};\n",
            s.tags.join(", "),
            s.name,
            dims_suffix(&s.dimensions)
        ));
        for tag in &s.tags {
            out.push_str(&format!("    {}_tagged.{} = {};\n", s.name, tag, tag));
        }
        out.push_str(&format!("    {}_tagged <== {};\n\n", s.name, s.name));
    }

    // Positional connection list in the inner template's input order.
    let args: Vec<String> = inputs.iter().copied().map(connected_name).collect();

    let outputs: Vec<&Signal> = template.outputs().collect();
    match outputs.as_slice() {
        [] => {
            // No outputs: use an explicit named component and wire inputs.
            out.push_str(&format!(
                "    component _inner = {}({});\n",
                template.name, inner_params
            ));
            for s in inputs.iter().copied() {
                out.push_str(&format!(
                    "    _inner.{} <== {};\n",
                    s.name,
                    connected_name(s)
                ));
            }
        }
        [single] => {
            out.push_str(&format!(
                "    signal output {}{};\n",
                single.name,
                dims_suffix(&single.dimensions)
            ));
            out.push_str(&format!(
                "    {} <== {}({})({});\n",
                single.name,
                template.name,
                inner_params,
                args.join(", ")
            ));
        }
        many => {
            for o in many {
                out.push_str(&format!(
                    "    signal output {}{};\n",
                    o.name,
                    dims_suffix(&o.dimensions)
                ));
            }
            let names: Vec<&str> = many.iter().map(|o| o.name.as_str()).collect();
            out.push_str(&format!(
                "    ({}) <== {}({})({});\n",
                names.join(", "),
                template.name,
                inner_params,
                args.join(", ")
            ));
        }
    }

    out.push_str("}\n");
    Ok(out)
}

/// Generate wrappers for every template in a program that has tagged inputs.
pub fn generate_tag_wrappers(program: &CircomProgram) -> Vec<String> {
    program
        .templates
        .iter()
        .filter_map(|t| generate_tag_wrapper(t).ok())
        .collect()
}

/// The signal name used when connecting an input to the inner template:
/// the tagged intermediate if the input is tagged, otherwise the input itself.
fn connected_name(s: &Signal) -> String {
    if s.tags.is_empty() {
        s.name.clone()
    } else {
        format!("{}_tagged", s.name)
    }
}

/// Render array dimensions as circom bracket suffixes, e.g. `["N", "M"]` -> `[N][M]`.
fn dims_suffix(dims: &[String]) -> String {
    dims.iter().map(|d| format!("[{d}]")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn template(src: &str, name: &str) -> Template {
        circomkit_parser::parse(src)
            .unwrap()
            .template(name)
            .unwrap()
            .clone()
    }

    #[test]
    fn wraps_bounded_add() {
        let src = r#"
            template BoundedAdd() {
                signal input {maxbits} a;
                signal input {maxbits} b;
                signal output out;
            }
        "#;
        let w = generate_tag_wrapper(&template(src, "BoundedAdd")).unwrap();

        assert!(w.contains("template BoundedAdd_wrapper(maxbits) {"));
        assert!(w.contains("signal input a;"));
        assert!(w.contains("signal input b;"));
        assert!(w.contains("signal {maxbits} a_tagged;"));
        assert!(w.contains("a_tagged.maxbits = maxbits;"));
        assert!(w.contains("a_tagged <== a;"));
        assert!(w.contains("signal output out;"));
        assert!(w.contains("out <== BoundedAdd()(a_tagged, b_tagged);"));
    }

    #[test]
    fn keeps_original_params_and_array_dims() {
        let src = r#"
            template Foo(n) {
                signal input {binary} in[n];
                signal input plain;
                signal output out;
            }
        "#;
        let w = generate_tag_wrapper(&template(src, "Foo")).unwrap();

        // original param `n` precedes the tag param `binary`
        assert!(w.contains("template Foo_wrapper(n, binary) {"));
        assert!(w.contains("signal input in[n];"));
        assert!(w.contains("signal {binary} in_tagged[n];"));
        // untagged input is forwarded directly
        assert!(w.contains("signal input plain;"));
        assert!(w.contains("out <== Foo(n)(in_tagged, plain);"));
    }

    #[test]
    fn multiple_outputs_use_tuple_assignment() {
        let src = r#"
            template Split() {
                signal input {maxbits} x;
                signal output lo;
                signal output hi;
            }
        "#;
        let w = generate_tag_wrapper(&template(src, "Split")).unwrap();
        assert!(w.contains("(lo, hi) <== Split()(x_tagged);"));
    }

    #[test]
    fn errors_without_tagged_inputs() {
        let src = r#"
            template Plain() {
                signal input a;
                signal output b;
            }
        "#;
        let err = generate_tag_wrapper(&template(src, "Plain")).unwrap_err();
        assert!(matches!(err, CodegenError::NoTaggedInputs(_)));
    }
}
