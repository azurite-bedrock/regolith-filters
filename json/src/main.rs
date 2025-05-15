use clap::Args;
use std::env::current_dir;

#[derive(Args)]
struct AppArgs {}

fn main() {
    current_dir()
}
