//! A tiny integer-expression evaluator for Circom array dimensions and template
//! arguments (e.g. `N`, `n-1`, `N*M`, `2**k`).
//!
//! Circom array sizes and instantiation arguments must be compile-time integer
//! constants, so evaluating them given the template's parameter bindings yields
//! the concrete shape/value we need for codegen.

use std::collections::HashMap;

/// Evaluate an integer expression using the provided identifier bindings.
///
/// Supports `+ - * / % **`, unary `+`/`-`, parentheses, decimal integer
/// literals, and identifiers looked up in `vars`. Division/modulo are integer
/// operations and error on a zero divisor.
pub fn eval_expr(expr: &str, vars: &HashMap<String, i64>) -> Result<i64, String> {
    let tokens = tokenize(expr)?;
    let mut parser = Eval {
        tokens: &tokens,
        pos: 0,
        vars,
    };
    let value = parser.expr()?;
    if parser.pos != parser.tokens.len() {
        return Err(format!("unexpected trailing tokens in `{expr}`"));
    }
    Ok(value)
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Tok {
    Num(i64),
    Ident(String),
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Pow,
    LParen,
    RParen,
}

fn tokenize(s: &str) -> Result<Vec<Tok>, String> {
    let mut toks = Vec::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
            continue;
        }
        match c {
            '+' => {
                toks.push(Tok::Plus);
                i += 1;
            }
            '-' => {
                toks.push(Tok::Minus);
                i += 1;
            }
            '*' => {
                if i + 1 < chars.len() && chars[i + 1] == '*' {
                    toks.push(Tok::Pow);
                    i += 2;
                } else {
                    toks.push(Tok::Star);
                    i += 1;
                }
            }
            '/' => {
                toks.push(Tok::Slash);
                i += 1;
            }
            '%' => {
                toks.push(Tok::Percent);
                i += 1;
            }
            '(' => {
                toks.push(Tok::LParen);
                i += 1;
            }
            ')' => {
                toks.push(Tok::RParen);
                i += 1;
            }
            _ if c.is_ascii_digit() => {
                let start = i;
                while i < chars.len() && chars[i].is_ascii_digit() {
                    i += 1;
                }
                let num: String = chars[start..i].iter().collect();
                let val = num
                    .parse::<i64>()
                    .map_err(|e| format!("invalid number `{num}`: {e}"))?;
                toks.push(Tok::Num(val));
            }
            _ if c.is_ascii_alphabetic() || c == '_' => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                    i += 1;
                }
                toks.push(Tok::Ident(chars[start..i].iter().collect()));
            }
            other => return Err(format!("unexpected character `{other}` in expression")),
        }
    }
    Ok(toks)
}

struct Eval<'a> {
    tokens: &'a [Tok],
    pos: usize,
    vars: &'a HashMap<String, i64>,
}

impl Eval<'_> {
    fn peek(&self) -> Option<&Tok> {
        self.tokens.get(self.pos)
    }

    // expr := term (('+' | '-') term)*
    fn expr(&mut self) -> Result<i64, String> {
        let mut acc = self.term()?;
        while let Some(tok) = self.peek() {
            match tok {
                Tok::Plus => {
                    self.pos += 1;
                    acc = acc.checked_add(self.term()?).ok_or("integer overflow")?;
                }
                Tok::Minus => {
                    self.pos += 1;
                    acc = acc.checked_sub(self.term()?).ok_or("integer overflow")?;
                }
                _ => break,
            }
        }
        Ok(acc)
    }

    // term := power (('*' | '/' | '%') power)*
    fn term(&mut self) -> Result<i64, String> {
        let mut acc = self.power()?;
        while let Some(tok) = self.peek() {
            match tok {
                Tok::Star => {
                    self.pos += 1;
                    acc = acc.checked_mul(self.power()?).ok_or("integer overflow")?;
                }
                Tok::Slash => {
                    self.pos += 1;
                    let d = self.power()?;
                    if d == 0 {
                        return Err("division by zero".into());
                    }
                    acc /= d;
                }
                Tok::Percent => {
                    self.pos += 1;
                    let d = self.power()?;
                    if d == 0 {
                        return Err("modulo by zero".into());
                    }
                    acc %= d;
                }
                _ => break,
            }
        }
        Ok(acc)
    }

    // power := unary ('**' power)?   (right-associative)
    fn power(&mut self) -> Result<i64, String> {
        let base = self.unary()?;
        if let Some(Tok::Pow) = self.peek() {
            self.pos += 1;
            let exp = self.power()?;
            if exp < 0 {
                return Err("negative exponent".into());
            }
            let mut result: i64 = 1;
            for _ in 0..exp {
                result = result.checked_mul(base).ok_or("integer overflow")?;
            }
            Ok(result)
        } else {
            Ok(base)
        }
    }

    // unary := ('+' | '-') unary | primary
    fn unary(&mut self) -> Result<i64, String> {
        match self.peek() {
            Some(Tok::Minus) => {
                self.pos += 1;
                Ok(-self.unary()?)
            }
            Some(Tok::Plus) => {
                self.pos += 1;
                self.unary()
            }
            _ => self.primary(),
        }
    }

    // primary := number | ident | '(' expr ')'
    fn primary(&mut self) -> Result<i64, String> {
        let tok = self.tokens.get(self.pos).cloned();
        self.pos += 1;
        match tok {
            Some(Tok::Num(n)) => Ok(n),
            Some(Tok::Ident(id)) => self
                .vars
                .get(&id)
                .copied()
                .ok_or_else(|| format!("unknown identifier `{id}`")),
            Some(Tok::LParen) => {
                let v = self.expr()?;
                match self.tokens.get(self.pos) {
                    Some(Tok::RParen) => {
                        self.pos += 1;
                        Ok(v)
                    }
                    _ => Err("expected `)`".into()),
                }
            }
            other => Err(format!("unexpected token {other:?}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars() -> HashMap<String, i64> {
        HashMap::from([("N".to_string(), 4), ("M".to_string(), 3)])
    }

    #[test]
    fn basic_arithmetic() {
        let v = vars();
        assert_eq!(eval_expr("N", &v).unwrap(), 4);
        assert_eq!(eval_expr("N-1", &v).unwrap(), 3);
        assert_eq!(eval_expr("N * M", &v).unwrap(), 12);
        assert_eq!(eval_expr("(N + 1) * 2", &v).unwrap(), 10);
        assert_eq!(eval_expr("2**3", &v).unwrap(), 8);
        assert_eq!(eval_expr("N % M", &v).unwrap(), 1);
        assert_eq!(eval_expr("-N + 5", &v).unwrap(), 1);
    }

    #[test]
    fn precedence_and_assoc() {
        let v = vars();
        assert_eq!(eval_expr("1 + 2 * 3", &v).unwrap(), 7);
        assert_eq!(eval_expr("2 ** 3 ** 2", &v).unwrap(), 512); // right-assoc
    }

    #[test]
    fn errors() {
        let v = vars();
        assert!(eval_expr("N / 0", &v).is_err());
        assert!(eval_expr("N % 0", &v).is_err());
        assert!(eval_expr("X", &v).is_err());
        assert!(eval_expr("1 +", &v).is_err());
        assert!(eval_expr("(1 + 2", &v).is_err());
    }
}
