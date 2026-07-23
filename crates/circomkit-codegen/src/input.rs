//! Input-JSON scaffolding.
//!
//! Given a template and concrete parameter bindings, emit a placeholder input
//! object mapping each input signal to a zero-filled value of the correct array
//! shape — a starting point users fill in with real values.

use std::collections::HashMap;

use circomkit_parser::{MainComponent, Template};
use serde_json::{Map, Value};

use crate::CodegenError;
use crate::eval::eval_expr;

/// Bind a template's parameters to the arguments of a `main` component.
///
/// Arguments are evaluated as integer expressions (they are compile-time
/// constants in circom). Earlier bindings are visible to later arguments.
pub fn bind_params(
    template: &Template,
    main: &MainComponent,
) -> Result<HashMap<String, i64>, CodegenError> {
    if template.params.len() != main.args.len() {
        return Err(CodegenError::ParamArity {
            template: template.name.clone(),
            expected: template.params.len(),
            got: main.args.len(),
        });
    }

    let mut bindings = HashMap::new();
    for (name, arg) in template.params.iter().zip(&main.args) {
        let value = eval_expr(arg, &bindings).map_err(|reason| CodegenError::DimEval {
            expr: arg.clone(),
            reason,
        })?;
        bindings.insert(name.clone(), value);
    }
    Ok(bindings)
}

/// Build a placeholder input object for a template's input signals.
///
/// Each input's array dimensions are evaluated against `params`; scalars map to
/// `0` and arrays to nested arrays of `0`.
pub fn scaffold_input(
    template: &Template,
    params: &HashMap<String, i64>,
) -> Result<Value, CodegenError> {
    let mut obj = Map::new();
    for sig in template.inputs() {
        let mut dims = Vec::with_capacity(sig.dimensions.len());
        for d in &sig.dimensions {
            let n = eval_expr(d, params).map_err(|reason| CodegenError::DimEval {
                expr: d.clone(),
                reason,
            })?;
            if n < 0 {
                return Err(CodegenError::DimEval {
                    expr: d.clone(),
                    reason: "negative dimension".to_string(),
                });
            }
            dims.push(n as usize);
        }
        obj.insert(sig.name.clone(), zeros(&dims));
    }
    Ok(Value::Object(obj))
}

/// Pretty-printed JSON string version of [`scaffold_input`].
pub fn scaffold_input_string(
    template: &Template,
    params: &HashMap<String, i64>,
) -> Result<String, CodegenError> {
    let value = scaffold_input(template, params)?;
    // serialization of a plain object never fails
    Ok(serde_json::to_string_pretty(&value).expect("json serialization"))
}

/// A nested array of zeros with the given dimensions (scalar `0` if empty).
fn zeros(dims: &[usize]) -> Value {
    match dims.split_first() {
        None => Value::from(0),
        Some((&head, rest)) => Value::Array((0..head).map(|_| zeros(rest)).collect()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ARRAYS: &str = r#"
        template Arrays(N, M) {
            signal input in;
            signal input in1D[N];
            signal input in2D[N][M];
            signal output out;
        }
        component main = Arrays(2, 3);
    "#;

    #[test]
    fn scaffolds_nested_shapes() {
        let program = circomkit_parser::parse(ARRAYS).unwrap();
        let t = program.template("Arrays").unwrap();
        let params = HashMap::from([("N".to_string(), 2), ("M".to_string(), 3)]);

        let v = scaffold_input(t, &params).unwrap();
        assert_eq!(v["in"], json!(0));
        assert_eq!(v["in1D"], json!([0, 0]));
        assert_eq!(v["in2D"], json!([[0, 0, 0], [0, 0, 0]]));
        // output signals are not part of the input scaffold
        assert!(v.get("out").is_none());
    }

    #[test]
    fn binds_params_from_main() {
        let program = circomkit_parser::parse(ARRAYS).unwrap();
        let t = program.template("Arrays").unwrap();
        let main = program.main.as_ref().unwrap();

        let params = bind_params(t, main).unwrap();
        assert_eq!(params["N"], 2);
        assert_eq!(params["M"], 3);

        // end-to-end: bindings drive the scaffold
        let v = scaffold_input(t, &params).unwrap();
        assert_eq!(v["in2D"], json!([[0, 0, 0], [0, 0, 0]]));
    }

    #[test]
    fn arity_mismatch_errors() {
        let program = circomkit_parser::parse(
            r#"
            template T(A, B) { signal input x[A]; }
            component main = T(2);
        "#,
        )
        .unwrap();
        let t = program.template("T").unwrap();
        let main = program.main.as_ref().unwrap();
        assert!(matches!(
            bind_params(t, main),
            Err(CodegenError::ParamArity { .. })
        ));
    }

    #[test]
    fn pretty_string_is_valid_json() {
        let program = circomkit_parser::parse(ARRAYS).unwrap();
        let t = program.template("Arrays").unwrap();
        let params = HashMap::from([("N".to_string(), 2), ("M".to_string(), 3)]);

        let s = scaffold_input_string(t, &params).unwrap();
        let reparsed: Value = serde_json::from_str(&s).unwrap();
        assert_eq!(reparsed["in1D"], json!([0, 0]));
    }
}
