//! Abstract syntax tree for the Circom *interface* subset.
//!
//! These types capture only what codegen needs: template names/params, signal
//! directions/tags/dimensions, pragmas, includes, and the `main` component.

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

/// A parsed Circom source file, reduced to its interface.
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CircomProgram {
    /// `pragma` directives, in source order.
    pub pragmas: Vec<Pragma>,
    /// `include "..."` paths, in source order.
    pub includes: Vec<String>,
    /// Template definitions, in source order.
    pub templates: Vec<Template>,
    /// The `component main` declaration, if present.
    pub main: Option<MainComponent>,
}

impl CircomProgram {
    /// The declared circom language version (from `pragma circom <ver>`), if any.
    pub fn circom_version(&self) -> Option<&str> {
        self.pragmas.iter().find_map(|p| match p {
            Pragma::Circom(v) => Some(v.as_str()),
            _ => None,
        })
    }

    /// Whether the file declares `pragma custom_templates`.
    pub fn has_custom_templates(&self) -> bool {
        self.pragmas.iter().any(|p| matches!(p, Pragma::CustomTemplates))
    }

    /// Find a template by name.
    pub fn template(&self, name: &str) -> Option<&Template> {
        self.templates.iter().find(|t| t.name == name)
    }
}

/// A `pragma` directive.
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Pragma {
    /// `pragma circom <version>;` — carries the raw version string (e.g. `2.1.0`).
    Circom(String),
    /// `pragma custom_templates;`
    CustomTemplates,
    /// Any other pragma, carrying its raw body.
    Other(String),
}

/// A `template` definition (interface only).
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Template {
    /// Template name.
    pub name: String,
    /// Whether it was declared with the `custom` keyword.
    pub is_custom: bool,
    /// Template parameter names, in order (e.g. `["N", "M"]`).
    pub params: Vec<String>,
    /// All signal declarations, in source order.
    pub signals: Vec<Signal>,
}

impl Template {
    /// Input signals only.
    pub fn inputs(&self) -> impl Iterator<Item = &Signal> {
        self.signals.iter().filter(|s| s.direction == SignalDirection::Input)
    }

    /// Output signals only.
    pub fn outputs(&self) -> impl Iterator<Item = &Signal> {
        self.signals.iter().filter(|s| s.direction == SignalDirection::Output)
    }
}

/// Direction of a signal declaration.
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "lowercase"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SignalDirection {
    /// `signal input ...`
    Input,
    /// `signal output ...`
    Output,
    /// `signal ...` (intermediate/internal signal).
    #[default]
    Intermediate,
}

/// A single declared signal.
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Signal {
    /// Signal name.
    pub name: String,
    /// Direction (input / output / intermediate).
    pub direction: SignalDirection,
    /// Array dimensions as raw expression strings (e.g. `["N", "M"]` or `["n-1"]`).
    /// Empty for scalar signals.
    pub dimensions: Vec<String>,
    /// Tag names attached via `{tag}` syntax (e.g. `["maxbits"]`).
    pub tags: Vec<String>,
}

impl Signal {
    /// Whether the signal is an array (has one or more dimensions).
    pub fn is_array(&self) -> bool {
        !self.dimensions.is_empty()
    }
}

/// The `component main` declaration.
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct MainComponent {
    /// Instantiated template name.
    pub template: String,
    /// Instantiation arguments as raw expression strings (e.g. `["2", "3"]`).
    pub args: Vec<String>,
    /// Public signal names from `{public [...]}` (empty if omitted).
    pub public_signals: Vec<String>,
}
