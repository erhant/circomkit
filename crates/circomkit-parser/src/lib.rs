//! Lightweight parser for the *interface* of Circom source files.
//!
//! `circomkit-parser` extracts just enough structure from `.circom` sources to
//! drive code generation — template names and parameters, signal directions,
//! tags and array dimensions, pragmas, includes, and the `main` component. It
//! intentionally does **not** parse expressions, constraints, or statement
//! bodies, which keeps the grammar small and resilient.
//!
//! ```
//! let src = r#"
//!     pragma circom 2.1.0;
//!     template Multiplier(n) {
//!         signal input in[n];
//!         signal output out;
//!     }
//! "#;
//! let program = circomkit_parser::parse(src).unwrap();
//! let t = &program.templates[0];
//! assert_eq!(t.name, "Multiplier");
//! assert_eq!(t.params, ["n"]);
//! assert_eq!(t.inputs().count(), 1);
//! ```

mod ast;

use std::path::Path;

use pest::Parser;
use pest_derive::Parser;

pub use ast::{CircomProgram, MainComponent, Pragma, Signal, SignalDirection, Template};

#[derive(Parser)]
#[grammar = "circom.pest"]
struct CircomParser;

/// Errors that can occur while parsing Circom source.
#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    /// The source did not conform to the interface grammar.
    #[error("failed to parse circom source:\n{0}")]
    Syntax(#[from] Box<pest::error::Error<Rule>>),

    /// The source file could not be read from disk.
    #[error("failed to read circom file: {0}")]
    Io(#[from] std::io::Error),
}

/// Parse Circom source text into its interface [`CircomProgram`].
pub fn parse(src: &str) -> Result<CircomProgram, ParseError> {
    let mut pairs =
        CircomParser::parse(Rule::program, src).map_err(|e| ParseError::Syntax(Box::new(e)))?;
    // The top `program` pair is guaranteed by the grammar (SOI ~ item* ~ EOI).
    let program = pairs.next().expect("program rule always yields one pair");

    let mut out = CircomProgram::default();
    for item in program.into_inner() {
        match item.as_rule() {
            Rule::pragma_stmt => out.pragmas.push(parse_pragma(item)),
            Rule::include_stmt => out.includes.push(parse_include(item)),
            Rule::template_def => out.templates.push(parse_template(item)),
            Rule::main_component => out.main = Some(parse_main(item)),
            // function definitions and EOI carry no interface information
            _ => {}
        }
    }
    Ok(out)
}

/// Read and parse a Circom source file from disk.
pub fn parse_file(path: impl AsRef<Path>) -> Result<CircomProgram, ParseError> {
    let src = std::fs::read_to_string(path)?;
    parse(&src)
}

type Pair<'a> = pest::iterators::Pair<'a, Rule>;

fn parse_pragma(pair: Pair<'_>) -> Pragma {
    let body = pair
        .into_inner()
        .find(|p| p.as_rule() == Rule::pragma_body)
        .map(|p| p.as_str().trim().to_string())
        .unwrap_or_default();

    if body == "custom_templates" {
        Pragma::CustomTemplates
    } else if let Some(rest) = body.strip_prefix("circom") {
        Pragma::Circom(rest.trim().to_string())
    } else {
        Pragma::Other(body)
    }
}

fn parse_include(pair: Pair<'_>) -> String {
    pair.into_inner()
        .find(|p| p.as_rule() == Rule::string)
        .map(|p| unquote(p.as_str()))
        .unwrap_or_default()
}

fn parse_template(pair: Pair<'_>) -> Template {
    let mut template = Template::default();
    for p in pair.into_inner() {
        match p.as_rule() {
            Rule::custom_kw => template.is_custom = true,
            // The only direct `ident` child of a template_def is its name.
            Rule::ident => template.name = p.as_str().to_string(),
            Rule::param_list => template.params = child_idents(p),
            Rule::block => collect_signals(p, &mut template.signals),
            _ => {}
        }
    }
    template
}

/// Recursively collect signal declarations from a block and its nested blocks.
fn collect_signals(block: Pair<'_>, out: &mut Vec<Signal>) {
    for p in block.into_inner() {
        match p.as_rule() {
            Rule::signal_decl => parse_signal_decl(p, out),
            Rule::block => collect_signals(p, out),
            _ => {}
        }
    }
}

fn parse_signal_decl(pair: Pair<'_>, out: &mut Vec<Signal>) {
    let mut direction = SignalDirection::Intermediate;
    let mut tags: Vec<String> = Vec::new();
    let mut items: Vec<(String, Vec<String>)> = Vec::new();

    for p in pair.into_inner() {
        match p.as_rule() {
            Rule::signal_qualifier => {
                direction = if p.as_str().starts_with("input") {
                    SignalDirection::Input
                } else {
                    SignalDirection::Output
                };
            }
            Rule::tag_list => tags = child_idents(p),
            Rule::signal_item => {
                let mut name = String::new();
                let mut dims: Vec<String> = Vec::new();
                for q in p.into_inner() {
                    match q.as_rule() {
                        Rule::ident => name = q.as_str().to_string(),
                        Rule::dimension => {
                            if let Some(inner) = q.into_inner().next() {
                                dims.push(inner.as_str().trim().to_string());
                            }
                        }
                        _ => {}
                    }
                }
                items.push((name, dims));
            }
            _ => {}
        }
    }

    // All items in one declaration share the same direction and tags.
    for (name, dimensions) in items {
        out.push(Signal {
            name,
            direction,
            dimensions,
            tags: tags.clone(),
        });
    }
}

fn parse_main(pair: Pair<'_>) -> MainComponent {
    let mut main = MainComponent::default();
    for p in pair.into_inner() {
        match p.as_rule() {
            Rule::main_public => main.public_signals = child_idents(p),
            // The only direct `ident` child is the instantiated template name.
            Rule::ident => main.template = p.as_str().to_string(),
            Rule::arg_list => {
                main.args = p
                    .into_inner()
                    .filter(|q| q.as_rule() == Rule::arg)
                    .map(|q| q.as_str().trim().to_string())
                    .collect();
            }
            _ => {}
        }
    }
    main
}

/// Collect the direct `ident` children of a pair.
fn child_idents(pair: Pair<'_>) -> Vec<String> {
    pair.into_inner()
        .filter(|p| p.as_rule() == Rule::ident)
        .map(|p| p.as_str().to_string())
        .collect()
}

/// Strip surrounding double quotes from a string literal.
fn unquote(s: &str) -> String {
    s.strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .unwrap_or(s)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pragma_and_multiplier() {
        let src = r#"
            pragma circom 2.0.0;

            template IsZero() {
                signal input in;
                signal output out;
                signal inv;
                inv <-- in != 0 ? (1 / in) : 0;
            }

            template Multiplier(n) {
                assert(n > 1);
                signal input in[n];
                signal output out;
                signal inner[n-1];
            }
        "#;
        let p = parse(src).unwrap();
        assert_eq!(p.circom_version(), Some("2.0.0"));
        assert_eq!(p.templates.len(), 2);

        let mul = p.template("Multiplier").unwrap();
        assert_eq!(mul.params, ["n"]);
        assert_eq!(mul.inputs().count(), 1);
        assert_eq!(mul.outputs().count(), 1);

        let in_sig = mul.inputs().next().unwrap();
        assert_eq!(in_sig.name, "in");
        assert_eq!(in_sig.dimensions, ["n"]);

        // intermediate signal captured with its symbolic dimension
        let inner = mul.signals.iter().find(|s| s.name == "inner").unwrap();
        assert_eq!(inner.direction, SignalDirection::Intermediate);
        assert_eq!(inner.dimensions, ["n-1"]);
    }

    #[test]
    fn parses_multi_dimensional_arrays_and_params() {
        let src = r#"
            pragma circom 2.0.0;
            template Arrays(N, M) {
                signal input in;
                signal input in1D[N];
                signal input in2D[N][M];
            }
        "#;
        let p = parse(src).unwrap();
        let t = &p.templates[0];
        assert_eq!(t.params, ["N", "M"]);

        let in2d = t.signals.iter().find(|s| s.name == "in2D").unwrap();
        assert_eq!(in2d.dimensions, ["N", "M"]);
        assert!(in2d.is_array());
    }

    #[test]
    fn parses_signal_tags() {
        let src = r#"
            pragma circom 2.2.0;
            template BoundedAdd() {
                signal input {maxbits} a;
                signal input {maxbits} b;
                signal output out;
                signal {maxbits} a_tagged;
            }
        "#;
        let p = parse(src).unwrap();
        let t = &p.templates[0];

        let a = t.signals.iter().find(|s| s.name == "a").unwrap();
        assert_eq!(a.direction, SignalDirection::Input);
        assert_eq!(a.tags, ["maxbits"]);

        let tagged = t.signals.iter().find(|s| s.name == "a_tagged").unwrap();
        assert_eq!(tagged.direction, SignalDirection::Intermediate);
        assert_eq!(tagged.tags, ["maxbits"]);

        let out = t.signals.iter().find(|s| s.name == "out").unwrap();
        assert!(out.tags.is_empty());
    }

    #[test]
    fn parses_custom_templates() {
        let src = r#"
            pragma circom 2.1.0;
            pragma custom_templates;

            template custom CustomMul() {
                signal input a;
                signal input b;
                signal output out;
                out <-- a * b;
            }

            template CustomMultiplier() {
                signal input in1;
                signal output out;
                out <== CustomMul()(in1, in1);
            }
        "#;
        let p = parse(src).unwrap();
        assert!(p.has_custom_templates());

        let custom = p.template("CustomMul").unwrap();
        assert!(custom.is_custom);

        let regular = p.template("CustomMultiplier").unwrap();
        assert!(!regular.is_custom);
        // inline-assigned output signal is still captured
        assert_eq!(regular.outputs().count(), 1);
    }

    #[test]
    fn parses_main_component_with_public() {
        let src = r#"
            pragma circom 2.1.0;
            include "../arrays.circom";
            component main {public[in1D, in2D]} = Arrays(2, 3);
        "#;
        let p = parse(src).unwrap();
        assert_eq!(p.includes, ["../arrays.circom"]);

        let main = p.main.unwrap();
        assert_eq!(main.template, "Arrays");
        assert_eq!(main.args, ["2", "3"]);
        assert_eq!(main.public_signals, ["in1D", "in2D"]);
    }

    #[test]
    fn parses_main_component_without_public() {
        let src = r#"
            pragma circom 2.1.0;
            include "../errors.circom";
            component main = Errors();
        "#;
        let p = parse(src).unwrap();
        let main = p.main.unwrap();
        assert_eq!(main.template, "Errors");
        assert!(main.args.is_empty());
        assert!(main.public_signals.is_empty());
    }

    #[test]
    fn skips_comments_and_strings_with_braces() {
        let src = r#"
            pragma circom 2.0.0;
            // a comment with a brace } that must be ignored
            /* block comment { with braces } */
            template Logger() {
                signal input in;
                log("a string with a brace } inside");
                for (var i = 0; i < 2; i++) {
                    // nested block; signal below is still found
                }
                signal output out;
            }
        "#;
        let p = parse(src).unwrap();
        let t = &p.templates[0];
        assert_eq!(t.inputs().count(), 1);
        assert_eq!(t.outputs().count(), 1);
    }

    #[test]
    fn does_not_match_identifier_prefixes() {
        // `signaled` and `templateX` must not be mistaken for keywords.
        let src = r#"
            pragma circom 2.0.0;
            template Foo() {
                signal input in;
                var signaled = 1;
            }
        "#;
        let p = parse(src).unwrap();
        let t = &p.templates[0];
        // only the real `in` signal, not `signaled`
        assert_eq!(t.signals.len(), 1);
        assert_eq!(t.signals[0].name, "in");
    }
}
