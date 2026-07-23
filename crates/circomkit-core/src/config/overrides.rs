/// Macro to generate partial config structs where every field is `Option<T>`.
/// Used for per-circuit config overrides.
macro_rules! partial_config {
    (
        $(#[$meta:meta])*
        pub struct $name:ident merges into $base:ty {
            $(
                $(#[$field_meta:meta])*
                pub $field:ident : $ty:ty
            ),* $(,)?
        }
    ) => {
        $(#[$meta])*
        pub struct $name {
            $(
                $(#[$field_meta])*
                pub $field: Option<$ty>,
            )*
        }

        impl $name {
            /// Merge non-None fields into the base config.
            pub fn merge_into(&self, base: &mut $base) {
                $(
                    if let Some(v) = &self.$field {
                        base.$field = v.clone();
                    }
                )*
            }
        }
    };
}

pub(crate) use partial_config;
