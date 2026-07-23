//! Code generation for Circom circuits.
//!
//! Consumers of the parsed interface AST (from [`circomkit_parser`]):
//!
//! - [`generate_tag_wrapper`] — emit a wrapper template with untagged inputs for
//!   a template whose inputs carry `{tag}` metadata (issue #116).
//! - [`scaffold_input`] / [`scaffold_input_string`] — emit a placeholder input
//!   JSON object with correctly-shaped, zero-filled arrays.
//!
//! Plus config-independent main-component generation:
//!
//! - [`make_circuit_source`] / [`instantiate_circuit`] — generate the
//!   `component main` file from a [`MainComponentSpec`].
//!
//! ```
//! let src = r#"
//!     template BoundedAdd() {
//!         signal input {maxbits} a;
//!         signal input {maxbits} b;
//!         signal output out;
//!     }
//! "#;
//! let program = circomkit_parser::parse(src).unwrap();
//! let template = program.template("BoundedAdd").unwrap();
//! let wrapper = circomkit_codegen::generate_tag_wrapper(template).unwrap();
//! assert!(wrapper.contains("template BoundedAdd_wrapper(maxbits)"));
//! ```

mod eval;
mod input;
mod main_component;
mod wrapper;

pub use eval::eval_expr;
pub use input::{bind_params, scaffold_input, scaffold_input_string};
pub use main_component::{MainComponentSpec, instantiate_circuit, make_circuit_source};
pub use wrapper::{generate_tag_wrapper, generate_tag_wrapper_with_suffix, generate_tag_wrappers};

// Re-export the AST types these functions operate on, so downstream crates
// don't need a direct dependency on circomkit-parser just to name them.
pub use circomkit_parser::{CircomProgram, MainComponent, Signal, SignalDirection, Template};

/// Errors produced during code generation.
#[derive(Debug, thiserror::Error)]
pub enum CodegenError {
    /// A tag wrapper was requested for a template with no tagged inputs.
    #[error("template `{0}` has no tagged inputs; no wrapper needed")]
    NoTaggedInputs(String),

    /// A dimension or argument expression could not be evaluated to an integer.
    #[error("cannot evaluate expression `{expr}`: {reason}")]
    DimEval {
        /// The offending expression.
        expr: String,
        /// Why evaluation failed.
        reason: String,
    },

    /// A `main` component's argument count did not match the template's parameters.
    #[error("template `{template}` expects {expected} parameter(s) but got {got}")]
    ParamArity {
        /// Template name.
        template: String,
        /// Number of declared parameters.
        expected: usize,
        /// Number of supplied arguments.
        got: usize,
    },

    /// The source could not be parsed.
    #[error(transparent)]
    Parse(#[from] circomkit_parser::ParseError),
}
